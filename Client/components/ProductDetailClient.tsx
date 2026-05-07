"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Download, Eye, MessageSquare, ShieldCheck, Star, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import {
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
  if (typeof window === "undefined") return null;
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
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${PRODUCT_DETAIL_CACHE_PREFIX}${payload.slug}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore
  }
}

function ProductGallery({ product }: { product: StoreProduct }) {
  const images = product.images.filter(Boolean);
  const [active, setActive] = useState(0);
  const src = images[active] ?? null;

  return (
    <div className="pd-gallery">
      <div className="pd-gallery__main">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={product.name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={(e) => { e.currentTarget.src = "/marketplace-console.svg"; }}
            className="pd-gallery__img"
          />
        ) : (
          <span className="pd-gallery__placeholder">{product.type}</span>
        )}
      </div>

      {images.length > 1 ? (
        <div className="pd-gallery__thumbs">
          {images.slice(0, 5).map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`pd-gallery__thumb${i === active ? " is-active" : ""}`}
              aria-label={`Ảnh ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailClient({
  product,
  initialReviews,
  initialAverageRating,
}: ProductDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, apiFetch } = useAuth();
  const { productMetrics, reviewVersionByProduct, productUpdates } = useRealtime();
  const { showToast } = useToast();

  const [currentProduct, setCurrentProduct] = useState<StoreProduct>(product);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
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
    setLocalMetrics((c) => ({
      stock: cached.product.stock ?? c.stock,
      viewCount: cached.product.viewCount ?? c.viewCount,
      soldCount: cached.product.soldCount ?? c.soldCount,
      rating: cached.averageRating ?? c.rating,
      reviewsCount: cached.reviewsCount ?? c.reviewsCount,
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
      const d = response.data;
      setCurrentProduct((c) => ({
        ...c,
        stock: d.stock ?? c.stock,
        viewCount: d.viewCount ?? c.viewCount,
        soldCount: d.soldCount ?? c.soldCount,
        rating: d.averageRating ?? c.rating,
        reviewsCount: d._count?.reviews ?? c.reviewsCount,
      }));
      setLocalMetrics((c) => ({
        stock: d.stock ?? c.stock,
        viewCount: d.viewCount ?? c.viewCount,
        soldCount: d.soldCount ?? c.soldCount,
        rating: d.averageRating ?? c.rating,
        reviewsCount: d._count?.reviews ?? c.reviewsCount,
      }));
    } catch {
      // keep current
    }
  }, [apiFetch, isNumericProductId, productId]);

  const loadReviews = useCallback(async () => {
    if (!isNumericProductId) return;
    setIsLoadingReviews(true);
    try {
      const response = await apiFetch<ApiEnvelope<ReviewListData>>(
        `/reviews/product/${productId}?page=1&limit=10`,
        { notifySuccess: false },
      );
      const nextReviews = response.data.data ?? [];
      const total = response.data.pagination?.total ?? nextReviews.length;
      setReviews(nextReviews);
      setReviewPage(1);
      setReviewTotalPages(Math.ceil(total / 10));
      setLocalMetrics((c) => ({
        ...c,
        rating: response.data.stats?.averageRating ?? c.rating,
        reviewsCount: total,
      }));
    } catch {
      // keep current
    } finally {
      setIsLoadingReviews(false);
    }
  }, [apiFetch, isNumericProductId, productId]);

  const loadMoreReviews = useCallback(async () => {
    if (!isNumericProductId || isLoadingMore) return;
    const nextPage = reviewPage + 1;
    setIsLoadingMore(true);
    try {
      const response = await apiFetch<ApiEnvelope<ReviewListData>>(
        `/reviews/product/${productId}?page=${nextPage}&limit=10`,
        { notifySuccess: false },
      );
      const more = response.data.data ?? [];
      setReviews((c) => [...c, ...more]);
      setReviewPage(nextPage);
    } catch {
      // keep current
    } finally {
      setIsLoadingMore(false);
    }
  }, [apiFetch, isLoadingMore, isNumericProductId, productId, reviewPage]);

  useEffect(() => {
    if (!isNumericProductId || trackedViewRef.current) return;
    trackedViewRef.current = true;
    apiFetch<ApiEnvelope<{ productId: string; viewCount: number; soldCount: number; stock: number; rating: number; reviewsCount: number }>>(
      `/products/${productId}/view`,
      { method: "POST", notifySuccess: false },
    )
      .then((r) => {
        const d = r.data;
        setLocalMetrics((c) => ({
          stock: d.stock ?? c.stock,
          viewCount: d.viewCount ?? c.viewCount,
          soldCount: d.soldCount ?? c.soldCount,
          rating: d.rating ?? c.rating,
          reviewsCount: d.reviewsCount ?? c.reviewsCount,
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
    setCurrentProduct((c) => ({
      ...c,
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
    const timer = window.setInterval(() => refreshMetrics(), 8000);
    return () => window.clearInterval(timer);
  }, [isNumericProductId, refreshMetrics]);

  async function submitReview() {
    if (isSubmittingReview) return;
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
      showToast("Vui lòng chọn số sao trước khi gửi.", "error");
      return;
    }
    setIsSubmittingReview(true);
    try {
      const response = await apiFetch<ApiEnvelope<Review>>("/reviews", {
        method: "POST",
        notifySuccess: false,
        body: JSON.stringify({ productId, rating: pendingRating, content: reviewText.trim() }),
      });
      setPendingRating(0);
      setReviewText("");
      setReviews((c) => [response.data, ...c].slice(0, 10));
      setLocalMetrics((c) => ({ ...c, reviewsCount: c.reviewsCount + 1 }));
      showToast("Đã gửi đánh giá.", "success");
      loadReviews();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể gửi đánh giá.";
      const isNotPurchased = msg.includes("mua sản phẩm") || msg.includes("403");
      const isAlreadyReviewed = msg.includes("đã đánh giá");
      if (isNotPurchased) {
        showToast("Bạn cần mua sản phẩm này trước khi đánh giá.", "error");
      } else if (isAlreadyReviewed) {
        showToast("Bạn đã đánh giá sản phẩm này rồi.", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <div className="pd-layout">
      {/* ── Left: main content ── */}
      <div className="pd-main">

        {/* Breadcrumb */}
        <nav className="pd-breadcrumb" aria-label="Đường dẫn">
          <Link href="/catalog" className="pd-breadcrumb__link">Sản phẩm</Link>
          <span className="pd-breadcrumb__sep" aria-hidden="true">/</span>
          <Link href={`/catalog?type=${currentProduct.type}`} className="pd-breadcrumb__link">
            {productTypeLabel(currentProduct.type)}
          </Link>
          <span className="pd-breadcrumb__sep" aria-hidden="true">/</span>
          <span className="pd-breadcrumb__current">{currentProduct.name}</span>
        </nav>

        {/* Gallery */}
        <ProductGallery product={currentProduct} />

        {/* Title + meta */}
        <div className="pd-info">
          <p className="pd-info__eyebrow">
            <span className="pd-info__type-badge">{productTypeLabel(currentProduct.type)}</span>
            <span className="pd-info__status-badge">{currentProduct.status === "APPROVED" ? "Đã duyệt" : currentProduct.status}</span>
          </p>
          <h1 className="pd-info__title">{currentProduct.name}</h1>
          <p className="pd-info__desc">{currentProduct.description}</p>

          <div className="pd-info__stats">
            <span className="pd-info__stat">
              <Star size={13} fill="currentColor" className="star-yellow" />
              {ratingLabel} · {reviewsCount} đánh giá
            </span>
            <span className="pd-info__stat-sep" aria-hidden="true">·</span>
            <span className="pd-info__stat">
              <Eye size={13} />
              {viewCount} lượt xem
            </span>
            <span className="pd-info__stat-sep" aria-hidden="true">·</span>
            <span className="pd-info__stat">
              <Download size={13} />
              {soldCount} đã bán
            </span>
          </div>
        </div>

        {/* Trust block */}
        <div className="pd-trust">
          <div className="pd-trust__item">
            <BadgeCheck size={18} className="pd-trust__icon" />
            <div>
              <p className="pd-trust__title">Người bán xác thực</p>
              <p className="pd-trust__desc">{currentProduct.sellerName ?? "Người bán"} đăng sản phẩm qua quy trình duyệt của hệ thống.</p>
            </div>
          </div>
          <div className="pd-trust__item">
            <ShieldCheck size={18} className="pd-trust__icon" />
            <div>
              <p className="pd-trust__title">Bàn giao tức thì</p>
              <p className="pd-trust__desc">Đơn hàng trừ kho realtime và xử lý ngay sau khi thanh toán bằng ví.</p>
            </div>
          </div>
          <div className="pd-trust__item">
            <MessageSquare size={18} className="pd-trust__icon" />
            <div>
              <p className="pd-trust__title">Hỗ trợ sẵn sàng</p>
              <p className="pd-trust__desc">Liên hệ người bán trực tiếp hoặc qua hệ thống hỗ trợ của marketplace.</p>
            </div>
          </div>
        </div>

        {/* Spec table */}
        <div className="pd-spec">
          <p className="pd-spec__label">Thông tin sản phẩm</p>
          <dl className="pd-spec__dl">
            <div className="pd-spec__row">
              <dt>Loại</dt>
              <dd>{productTypeLabel(currentProduct.type)}</dd>
            </div>
            <div className="pd-spec__row">
              <dt>Danh mục</dt>
              <dd>{currentProduct.categoryName ?? "Chưa phân loại"}</dd>
            </div>
            <div className="pd-spec__row">
              <dt>Người bán</dt>
              <dd>{currentProduct.sellerName ?? "Marketplace"}</dd>
            </div>
            <div className="pd-spec__row">
              <dt>Tồn kho</dt>
              <dd className={currentStock > 0 ? "pd-spec__stock--live" : "pd-spec__stock--out"}>
                {currentStock > 0 ? `${currentStock} sản phẩm` : "Hết hàng"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Reviews */}
        <div className="pd-reviews">
          <div className="pd-reviews__head">
            <div>
              <p className="pd-spec__label">Đánh giá</p>
              <h2 className="pd-reviews__title">
                <Star size={16} fill="currentColor" className="pd-reviews__title-star star-yellow" />
                {ratingLabel}
                <span className="pd-reviews__title-count">({reviewsCount} đánh giá)</span>
              </h2>
            </div>
            <Link href={`/catalog?type=${currentProduct.type}`} className="pd-reviews__similar">
              Sản phẩm tương tự →
            </Link>
          </div>

          {/* Review form */}
          <div className="pd-review-form">
            <p className="pd-review-form__heading">Gửi đánh giá của bạn</p>
            <div className="pd-review-form__stars">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`pd-review-form__star-btn${v <= pendingRating ? " is-active" : ""}`}
                  onClick={() => setPendingRating(v)}
                  disabled={isSubmittingReview}
                  aria-label={`${v} sao`}
                >
                  <Star size={18} fill={v <= pendingRating ? "currentColor" : "none"} />
                </button>
              ))}
              <span className="pd-review-form__star-label">
                {pendingRating > 0 ? `${pendingRating}/5` : "Chọn sao"}
              </span>
            </div>
            <textarea
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Nhận xét của bạn (không bắt buộc)"
              className="pd-review-form__textarea"
              disabled={isSubmittingReview}
            />
            <div className="pd-review-form__footer">
              <button
                type="button"
                className="pd-review-form__submit"
                onClick={submitReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </div>

          {/* Review list */}
          {isLoadingReviews ? (
            <p className="pd-reviews__loading">Đang tải đánh giá...</p>
          ) : reviews.length ? (
            <>
              <div className="pd-review-list">
                {reviews.map((review) => {
                  const name = review.user?.name ?? "Người mua";
                  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const avatar = review.user?.avatar;
                  return (
                    <article key={review.id} className="pd-review-item">
                      <div className="pd-review-item__top">
                        {/* Avatar */}
                        <div className="pd-review-item__avatar">
                          {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar} alt={name} className="pd-review-item__avatar-img" />
                          ) : (
                            <span className="pd-review-item__avatar-initials">{initials}</span>
                          )}
                        </div>

                        {/* Name + rating + content */}
                        <div className="pd-review-item__body">
                          <div className="pd-review-item__header">
                            <strong className="pd-review-item__name">{name}</strong>
                            <span className="pd-review-item__rating">
                              {[1,2,3,4,5].map((s) => (
                                <Star
                                  key={s}
                                  size={11}
                                  fill={s <= review.rating ? "currentColor" : "none"}
                                  className={s <= review.rating ? "star-yellow" : "pd-review-item__star-empty"}
                                />
                              ))}
                            </span>
                          </div>
                          {review.content?.trim() ? (
                            <p className="pd-review-item__content">{review.content}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {reviewPage < reviewTotalPages ? (
                <button
                  type="button"
                  className="pd-reviews__load-more"
                  onClick={loadMoreReviews}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Đang tải..." : `Xem thêm đánh giá (${reviewsCount - reviews.length} còn lại)`}
                </button>
              ) : reviews.length >= 10 ? (
                <p className="pd-reviews__all-loaded">Đã hiển thị tất cả {reviews.length} đánh giá</p>
              ) : null}
            </>
          ) : (
            <p className="pd-reviews__empty">Chưa có đánh giá. Hãy là người đầu tiên.</p>
          )}
        </div>
      </div>

      {/* ── Right: purchase panel ── */}
      <ProductPurchasePanel product={{ ...currentProduct, stock: currentStock }} />
    </div>
  );
}
