"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, ChevronRight, Download, Eye, MessageSquare, ShieldCheck, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import {
  formatCurrency,
  isNumericId,
  productTypeLabel,
  type ApiEnvelope,
  type Review,
  type ReviewListData,
  type StoreProduct,
} from "@/lib/api";

type ProductDetailClientProps = {
  product: StoreProduct;
  initialReviews: Review[];
  initialAverageRating: number;
};

type ProductDetailCachePayload = {
  slug: string;
  product: StoreProduct;
  reviews: Review[];
  averageRating: number;
  reviewsCount: number;
  cachedAt: number;
};

const PRODUCT_DETAIL_CACHE_PREFIX = "dora-product-detail-cache:";

function readProductDetailCache(slug: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(`${PRODUCT_DETAIL_CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductDetailCachePayload;
    return parsed?.slug === slug ? parsed : null;
  } catch {
    return null;
  }
}

function writeProductDetailCache(payload: ProductDetailCachePayload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(`${PRODUCT_DETAIL_CACHE_PREFIX}${payload.slug}`, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

function ProductGallery({ product }: { product: StoreProduct }) {
  const images = product.images.filter(Boolean);
  return (
    <div className="grid gap-3.5">
      <div className="grid place-items-center overflow-hidden text-primary bg-neutral border border-border rounded-md transition-all hover:border-tertiary/35 min-h-[clamp(280px,45vw,560px)]">
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[0]}
            alt={product.name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={(e) => { e.currentTarget.src = "/marketplace-console.svg"; }}
            className="block h-full w-full object-contain"
          />
        ) : (
          <span>{product.type}</span>
        )}
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {images.slice(0, 4).map((image, index) => (
            <div key={`${image}-${index}`} className="aspect-square grid place-items-center overflow-hidden text-primary bg-neutral border border-border rounded-md transition-all hover:border-tertiary/35">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`${product.name} ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="block h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailClient({ product, initialReviews, initialAverageRating }: ProductDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, apiFetch } = useAuth();
  const { productMetrics, reviewVersionByProduct, productUpdates } = useRealtime();
  const { showToast } = useToast();
  const [currentProduct, setCurrentProduct] = useState<StoreProduct>(product);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [localMetrics, setLocalMetrics] = useState({
    stock: product.stock,
    viewCount: product.viewCount,
    soldCount: product.soldCount,
    rating: initialAverageRating ?? product.rating,
    reviewsCount: product.reviewsCount,
  });
  const trackedViewRef = useRef(false);
  const productId = currentProduct.id;
  const isNumericProductId = isNumericId(productId);
  const reviewVersion = reviewVersionByProduct[productId] ?? 0;
  const liveMetrics = productMetrics[productId];

  const viewCount = liveMetrics?.viewCount ?? localMetrics.viewCount;
  const soldCount = liveMetrics?.soldCount ?? localMetrics.soldCount;
  const averageRating = liveMetrics?.rating ?? localMetrics.rating;
  const reviewsCount = liveMetrics?.reviewsCount ?? localMetrics.reviewsCount;
  const currentStock = liveMetrics?.stock ?? localMetrics.stock;

  const ratingLabel = useMemo(
    () => (averageRating > 0 ? averageRating.toFixed(1) : "0"),
    [averageRating],
  );

  useEffect(() => {
    setCurrentProduct(product);
    setReviews(initialReviews);
    setLocalMetrics({
      stock: product.stock,
      viewCount: product.viewCount,
      soldCount: product.soldCount,
      rating: initialAverageRating ?? product.rating,
      reviewsCount: product.reviewsCount,
    });
    trackedViewRef.current = false;
  }, [initialAverageRating, initialReviews, product]);

  useEffect(() => {
    const cached = readProductDetailCache(product.slug);
    if (!cached) return;

    setCurrentProduct(cached.product);
    setReviews(cached.reviews);
    setLocalMetrics((current) => ({
      stock: cached.product.stock ?? current.stock,
      viewCount: cached.product.viewCount ?? current.viewCount,
      soldCount: cached.product.soldCount ?? current.soldCount,
      rating: cached.averageRating ?? current.rating,
      reviewsCount: cached.reviewsCount ?? current.reviewsCount,
    }));
  }, [product.slug]);

  useEffect(() => {
    writeProductDetailCache({
      slug: currentProduct.slug,
      product: currentProduct,
      reviews,
      averageRating,
      reviewsCount,
      cachedAt: Date.now(),
    });
  }, [averageRating, currentProduct, reviews, reviewsCount]);

  const refreshMetrics = useCallback(async () => {
    if (!isNumericProductId) return;
    try {
      const response = await apiFetch<
        ApiEnvelope<{
          id: number;
          stock: number;
          viewCount: number;
          soldCount: number;
          averageRating?: number;
          _count?: { reviews?: number };
        }>
      >(`/products/${productId}`, { notifySuccess: false });
      setCurrentProduct((current) => ({
        ...current,
        stock: response.data.stock ?? current.stock,
        viewCount: response.data.viewCount ?? current.viewCount,
        soldCount: response.data.soldCount ?? current.soldCount,
        rating: response.data.averageRating ?? current.rating,
        reviewsCount: response.data._count?.reviews ?? current.reviewsCount,
      }));
      setLocalMetrics((current) => ({
        stock: response.data.stock ?? current.stock,
        viewCount: response.data.viewCount ?? current.viewCount,
        soldCount: response.data.soldCount ?? current.soldCount,
        rating: response.data.averageRating ?? current.rating,
        reviewsCount: response.data._count?.reviews ?? current.reviewsCount,
      }));
    } catch {
      // Keep current metrics if request fails.
    }
  }, [apiFetch, isNumericProductId, productId]);

  const loadReviews = useCallback(async () => {
    if (!isNumericProductId) return;

    setIsLoadingReviews(true);
    try {
      const response = await apiFetch<ApiEnvelope<ReviewListData>>(`/reviews/product/${productId}`, {
        notifySuccess: false,
      });
      const nextReviews = response.data.data ?? [];
      setReviews(nextReviews);
      setLocalMetrics((current) => ({
        ...current,
        rating: response.data.stats?.averageRating ?? current.rating,
        reviewsCount: response.data.pagination?.total ?? nextReviews.length,
      }));
    } catch {
      // Keep current reviews if request fails.
    } finally {
      setIsLoadingReviews(false);
    }
  }, [apiFetch, isNumericProductId, productId]);

  useEffect(() => {
    if (!isNumericProductId || trackedViewRef.current) return;
    trackedViewRef.current = true;

    apiFetch<
      ApiEnvelope<{
        productId: string;
        viewCount: number;
        soldCount: number;
        stock: number;
        rating: number;
        reviewsCount: number;
      }>
    >(`/products/${productId}/view`, { method: "POST", notifySuccess: false })
      .then((response) => {
        const data = response.data;
        setLocalMetrics((current) => ({
          stock: data.stock ?? current.stock,
          viewCount: data.viewCount ?? current.viewCount,
          soldCount: data.soldCount ?? current.soldCount,
          rating: data.rating ?? current.rating,
          reviewsCount: data.reviewsCount ?? current.reviewsCount,
        }));
      })
      .catch(() => undefined);
  }, [apiFetch, isNumericProductId, productId]);

  useEffect(() => {
    if (!isNumericProductId || reviewVersion === 0) return;
    loadReviews();
  }, [isNumericProductId, loadReviews, reviewVersion]);

  useEffect(() => {
    const update = productUpdates[productId];
    if (!update) return;
    setCurrentProduct((current) => ({
      ...current,
      ...(update.images ? { images: update.images } : {}),
      ...(update.name ? { name: update.name } : {}),
      ...(update.price !== undefined ? { price: update.price } : {}),
      ...(update.description !== undefined ? { description: update.description } : {}),
      ...(update.stock !== undefined ? { stock: update.stock } : {}),
      ...(update.slug ? { slug: update.slug } : {}),
    }));
  }, [productUpdates, productId]);

  useEffect(() => {
    if (!isNumericProductId) return;
    const timer = window.setInterval(() => {
      refreshMetrics();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isNumericProductId, refreshMetrics]);

  async function submitReview() {
    if (isSubmittingReview) {
      return;
    }
    if (!isAuthenticated) {
      showToast("Đăng nhập để gửi đánh giá.", "error");
      router.push(`/login?next=${encodeURIComponent(pathname || `/products/${currentProduct.slug}`)}`);
      return;
    }
    if (!isNumericProductId) {
      showToast("Sản phẩm demo không thể gửi đánh giá.", "error");
      return;
    }
    if (pendingRating <= 0) {
      showToast("Vui lòng chọn số sao trước khi gửi đánh giá.", "error");
      return;
    }
    setIsSubmittingReview(true);
    try {
      const response = await apiFetch<ApiEnvelope<Review>>("/reviews", {
        method: "POST",
        notifySuccess: false,
        body: JSON.stringify({
          productId,
          rating: pendingRating,
          content: reviewText.trim(),
        }),
      });

      setPendingRating(0);
      setReviewText("");
      setReviews((current) => [response.data, ...current].slice(0, 10));
      setLocalMetrics((current) => ({
        ...current,
        reviewsCount: current.reviewsCount + 1,
      }));
      showToast("Đã gửi đánh giá thành công.", "success");
      loadReviews();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể gửi đánh giá.", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <section className="product-detail product-detail--commerce">
      <div className="product-detail__main">
        <nav className="flex items-center gap-2 mb-[22px] text-secondary text-sm font-bold" aria-label="Đường dẫn">
          <Link href="/catalog">Sản phẩm</Link>
          <ChevronRight size={14} />
          <Link href={`/catalog?type=${currentProduct.type}`}>{productTypeLabel(currentProduct.type)}</Link>
        </nav>

        <ProductGallery product={currentProduct} />

        <div className="py-8">
          <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">{productTypeLabel(currentProduct.type)} · {currentProduct.status}</p>
          <h1>{currentProduct.name}</h1>
          <p>{currentProduct.description}</p>
          <div className="flex flex-wrap gap-2.5 mt-6">
            <span>
              <Star size={14} fill="currentColor" className="text-yellow-500" />
              {ratingLabel} · {reviewsCount} đánh giá
            </span>
            <span>
              <Eye size={14} />
              {viewCount} lượt xem
            </span>
            <span>
              <Download size={14} />
              {soldCount} đã bán
            </span>
          </div>
        </div>

        <div className="mt-4 p-[clamp(20px,2.6vw,28px)] bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all hover:border-tertiary/25 grid sm:grid-cols-3 gap-grid-gap">
          <article>
            <BadgeCheck size={20} />
            <h3>Người bán</h3>
            <p>{currentProduct.sellerName ?? "Người bán"} đã đăng sản phẩm qua quy trình duyệt của hệ thống.</p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <h3>Bàn giao</h3>
            <p>Đơn hàng trừ kho realtime và được xử lý ngay sau khi thanh toán bằng ví web.</p>
          </article>
          <article>
            <MessageSquare size={20} />
            <h3>Hỗ trợ</h3>
            <p>Chat và AI support đã có API, có thể bật Socket.IO cho support realtime ở phase tiếp theo.</p>
          </article>
        </div>

        <div className="mt-4 p-[clamp(20px,2.6vw,28px)] bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all hover:border-tertiary/25">
          <h2>Thông tin sản phẩm</h2>
          <dl className="grid gap-3.5 m-0">
            <div>
              <dt>Giá</dt>
              <dd>{formatCurrency(currentProduct.price)}</dd>
            </div>
            <div>
              <dt>Loại</dt>
              <dd>{productTypeLabel(currentProduct.type)}</dd>
            </div>
            <div>
              <dt>Danh mục</dt>
              <dd>{currentProduct.categoryName ?? "Chưa phân loại"}</dd>
            </div>
            <div>
              <dt>Tồn kho</dt>
              <dd>{currentStock}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 p-[clamp(20px,2.6vw,28px)] bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all hover:border-tertiary/25">
          <div className="grid justify-items-start mb-[34px] grid grid-cols-[minmax(0,1fr)_auto] gap-5 items-end mb-[18px]">
            <div>
              <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Đánh giá</p>
              <h2>Đánh giá gần đây</h2>
            </div>
            <Link href={`/catalog?type=${currentProduct.type}`} className="inline-flex min-h-[40px] items-center text-secondary text-sm font-bold hover:text-primary">
              Sản phẩm tương tự
            </Link>
          </div>

          <div className="grid gap-3.5 p-3.5 bg-neutral border border-border rounded-md mb-4">
            <p className="m-0 font-bold">Chọn sao để đánh giá</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="inline-grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-secondary hover:text-tertiary hover:border-tertiary/40"
                  onClick={() => setPendingRating(value)}
                  disabled={isSubmittingReview}
                >
                  <Star
                    size={16}
                    className={value <= pendingRating ? "text-yellow-500" : ""}
                    fill={value <= pendingRating ? "currentColor" : "none"}
                  />
                </button>
              ))}
              <span className="ml-1 text-sm font-bold">
                {isSubmittingReview ? "Đang gửi..." : `${pendingRating}/5`}
              </span>
            </div>
            <textarea
              rows={4}
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Viết thêm nhận xét của bạn (không bắt buộc)"
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-tertiary/40 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                onClick={submitReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </div>

          {isLoadingReviews ? <p>Đang tải đánh giá...</p> : null}
          {reviews.length ? (
            <div className="grid gap-3.5">
              {reviews.slice(0, 10).map((review) => (
                <article key={review.id} className="p-3.5 bg-neutral border border-transparent rounded-md transition-all hover:bg-surface hover:border-border hover:-translate-y-[1px]">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{review.user?.name ?? "Người mua"}</strong>
                    <span className="flex items-center gap-1 text-sm font-bold">
                      <Star size={14} fill="currentColor" className="text-yellow-500" />
                      {review.rating}/5
                    </span>
                  </div>
                  {review.content?.trim() ? <p>{review.content}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p>Chưa có đánh giá. Hãy là người mua đầu tiên để để lại đánh giá.</p>
          )}
        </div>
      </div>

      <ProductPurchasePanel product={{ ...currentProduct, stock: currentStock }} />
    </section>
  );
}
