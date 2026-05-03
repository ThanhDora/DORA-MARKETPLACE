"use client";

import Link from "next/link";
import { Heart, ShieldCheck, ShoppingCart, Star, Zap } from "lucide-react";
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
  const { stockUpdates, productUpdates } = useRealtime();
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const liveStock = stockUpdates[product.id] ?? product.stock;
  const liveProduct = productUpdates[product.id];
  const isAvailable = liveStock > 0 && product.status === "APPROVED";
  const ratingValue = product.rating > 0 ? product.rating.toFixed(1) : "0";

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
    <article
      className="commerce-card group relative flex min-w-0 min-h-[430px] flex-col"
    >
      <div className="commerce-card__meta">
        <span className="commerce-card__type">{productTypeLabel(product.type)}</span>
        <span className={isAvailable ? "commerce-card__stock is-live" : "commerce-card__stock"}>
          {isAvailable ? `${liveStock} còn lại` : "Hết hàng"}
        </span>
      </div>

      <Link href={getProductHref(product)} className="commerce-card__visual product-visual">
        {(liveProduct?.images?.[0] ?? product.images[0]) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={liveProduct?.images?.[0] ?? product.images[0]} alt={liveProduct?.name ?? product.name} loading={priority ? "eager" : "lazy"} />
        ) : (
          <span>{liveProduct?.type ?? product.type}</span>
        )}
      </Link>

      <div className="grid gap-1.5">
        <Link href={getProductHref(product)} className="commerce-card__title-link">
          <h3 className="commerce-card__title">{liveProduct?.name ?? product.name}</h3>
        </Link>
        <p className="commerce-card__description">{liveProduct?.description ?? product.description}</p>
      </div>

      <div className="commerce-card__badges">
        <span className="commerce-card__badge">
          <Zap size={14} />
          Giao số
        </span>
        <span className="commerce-card__badge">
          <ShieldCheck size={14} />
          Bảo vệ đơn
        </span>
      </div>

      <div className="commerce-card__footer">
        <div className="commerce-card__price-wrap">
          <strong className="commerce-card__price">{formatCurrency(liveProduct?.price ?? product.price)}</strong>
          <span className="commerce-card__unit">/{product.type.toLowerCase()}</span>
        </div>
        <div className="commerce-card__actions">
          <div className="commerce-card__rating commerce-card__rating--inline">
            <Star size={15} fill="currentColor" className="text-yellow-500" />
            <span>{ratingValue}/5 sao</span>
          </div>
          <div className="commerce-card__action-buttons">
            <button type="button" className="icon-action-btn" onClick={toggleWishlist} disabled={isBusy}>
              <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} className={isWishlisted ? "heart-filled" : ""} />
              <span className="sr-only">Lưu sản phẩm</span>
            </button>
            <button type="button" className="primary-action-btn min-h-[38px] px-3.5 py-2 text-[13px]" onClick={addToCart} disabled={!isAvailable || isBusy}>
              <ShoppingCart size={16} />
              Giỏ hàng
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
