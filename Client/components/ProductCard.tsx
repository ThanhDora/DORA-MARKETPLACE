"use client";

import Link from "next/link";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatCurrency,
  isNumericId,
  productTypeLabel,
  type ApiEnvelope,
  type StoreProduct,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import { notifyCartChanged } from "@/lib/cart-events";

type ProductCardProps = {
  product: StoreProduct;
  priority?: boolean;
};

function getProductHref(product: StoreProduct) {
  return `/products/${isNumericId(product.id) ? product.id : product.slug}`;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { isAuthenticated, apiFetch } = useAuth();
  const { stockUpdates, productUpdates, productMetrics } = useRealtime();
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const liveStock = stockUpdates[product.id] ?? product.stock;
  const liveProduct = productUpdates[product.id];
  const liveRating = productMetrics[product.id]?.rating ?? product.rating;
  const isAvailable = liveStock > 0 && product.status === "APPROVED";
  const ratingValue = liveRating > 0 ? liveRating.toFixed(1) : null;
  const name = liveProduct?.name ?? product.name;
  const description = liveProduct?.description ?? product.description;
  const price = liveProduct?.price ?? product.price;
  const image = liveProduct?.images?.[0] ?? product.images[0];
  const productType = liveProduct?.type ?? product.type;

  useEffect(() => {
    if (!isAuthenticated || !isNumericId(product.id)) return;
    apiFetch<ApiEnvelope<{ isInWishlist: boolean }>>(`/wishlist/${product.id}/check`)
      .then((res) => setIsWishlisted(res.data?.isInWishlist ?? false))
      .catch(() => {});
  }, [isAuthenticated, product.id, apiFetch]);

  async function addToCart() {
    if (!isAuthenticated) {
      showToast("Đăng nhập để thêm vào giỏ.", "error");
      return;
    }
    if (!isNumericId(product.id)) {
      showToast("Sản phẩm demo, cần backend để mua.", "error");
      return;
    }
    setIsBusy(true);
    try {
      await apiFetch<ApiEnvelope<unknown>>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      notifyCartChanged();
      showToast("Đã thêm vào giỏ.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể thêm vào giỏ.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleWishlist() {
    if (!isAuthenticated) {
      showToast("Đăng nhập để lưu sản phẩm.", "error");
      return;
    }
    if (!isNumericId(product.id)) {
      showToast("Sản phẩm demo, cần backend để lưu.", "error");
      return;
    }
    setIsBusy(true);
    const wasWishlisted = isWishlisted;
    setIsWishlisted(!wasWishlisted);
    try {
      if (wasWishlisted) {
        await apiFetch<ApiEnvelope<unknown>>(`/wishlist/${product.id}`, { method: "DELETE" });
        showToast("Đã xóa khỏi yêu thích.", "success");
      } else {
        await apiFetch<ApiEnvelope<unknown>>("/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId: product.id }),
        });
        showToast("Đã lưu vào yêu thích.", "success");
      }
    } catch (error) {
      setIsWishlisted(wasWishlisted);
      showToast(error instanceof Error ? error.message : "Không thể lưu sản phẩm.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className="product-card-v2">
      {/* ── Image area with overlaid badges and price ── */}
      <Link href={getProductHref(product)} className="product-card-v2__image-wrap">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            loading={priority ? "eager" : "lazy"}
            className="product-card-v2__img"
          />
        ) : (
          <div className="product-card-v2__placeholder">
            <span>{productType}</span>
          </div>
        )}

        {/* Top: type + stock */}
        <div className="product-card-v2__badges-top">
          <span className="product-card-v2__type-badge">{productTypeLabel(product.type)}</span>
          <span className={`product-card-v2__stock-badge${isAvailable ? " is-live" : ""}`}>
            {isAvailable ? `${liveStock} còn` : "Hết hàng"}
          </span>
        </div>

        {/* Bottom: price overlay */}
        <div className="product-card-v2__price-overlay">
          <strong className="product-card-v2__price">{formatCurrency(price)}</strong>
          <span className="product-card-v2__unit">/{product.type.toLowerCase()}</span>
        </div>
      </Link>

      {/* ── Body: title + description ── */}
      <div className="product-card-v2__body">
        <Link href={getProductHref(product)} className="product-card-v2__title-link">
          <h3 className="product-card-v2__title">{name}</h3>
        </Link>
        <p className="product-card-v2__desc">{description}</p>
      </div>

      {/* ── Footer: rating + actions ── */}
      <div className="product-card-v2__footer">
        <div className="product-card-v2__rating">
          <Star size={12} fill="currentColor" className="star-yellow" />
          <span className="product-card-v2__rating-num">{ratingValue ?? "0.0"}</span>
        </div>
        <div className="product-card-v2__actions">
          <button
            type="button"
            className="product-card-v2__wishlist-btn"
            onClick={toggleWishlist}
            disabled={isBusy}
            aria-label="Lưu sản phẩm"
          >
            <Heart
              size={15}
              fill={isWishlisted ? "currentColor" : "none"}
              className={isWishlisted ? "product-card-v2__heart-active" : ""}
            />
          </button>
          <button
            type="button"
            className="product-card-v2__buy-btn"
            onClick={addToCart}
            disabled={!isAvailable || isBusy}
          >
            <ShoppingCart size={13} />
            Giỏ hàng
          </button>
        </div>
      </div>
    </article>
  );
}
