"use client";

import Link from "next/link";
import { Heart, LockKeyhole, ShoppingCart, Star, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatCurrency,
  isNumericId,
  productTypeLabel,
  type ApiEnvelope,
  type StoreProduct,
  type WalletData,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import { notifyCartChanged } from "@/lib/cart-events";

export function ProductPurchasePanel({ product }: { product: StoreProduct }) {
  const { isAuthenticated, apiFetch } = useAuth();
  const { stockUpdates, productMetrics } = useRealtime();
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const liveStock = stockUpdates[product.id] ?? product.stock;
  const liveRating = productMetrics[product.id]?.rating ?? product.rating;
  const liveReviewsCount = productMetrics[product.id]?.reviewsCount ?? product.reviewsCount;
  const isAvailable = liveStock > 0 && product.status === "APPROVED";
  const hasEnoughWallet = walletBalance === null || walletBalance >= product.price;
  const checkoutHref = `/checkout?product=${encodeURIComponent(product.id)}`;

  useEffect(() => {
    if (!isAuthenticated || !isNumericId(product.id)) return;
    apiFetch<ApiEnvelope<{ isInWishlist: boolean }>>(`/wishlist/${product.id}/check`)
      .then((res) => setIsWishlisted(res.data?.isInWishlist ?? false))
      .catch(() => {});
  }, [isAuthenticated, product.id, apiFetch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch<ApiEnvelope<WalletData>>("/wallet", { notifySuccess: false })
      .then((res) => setWalletBalance(res.data.balance))
      .catch(() => {});
  }, [apiFetch, isAuthenticated]);

  async function addToCart() {
    if (!isAuthenticated) { showToast("Đăng nhập để thêm vào giỏ.", "error"); return; }
    if (!isNumericId(product.id)) { showToast("Sản phẩm demo, cần backend.", "error"); return; }
    setIsBusy(true);
    try {
      await apiFetch<ApiEnvelope<unknown>>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      notifyCartChanged();
      showToast("Đã thêm vào giỏ.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Thao tác thất bại.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleWishlist() {
    if (!isAuthenticated) { showToast("Đăng nhập để lưu sản phẩm.", "error"); return; }
    if (!isNumericId(product.id)) { showToast("Sản phẩm demo, cần backend.", "error"); return; }
    setIsBusy(true);
    const was = isWishlisted;
    setIsWishlisted(!was);
    try {
      if (was) {
        await apiFetch<ApiEnvelope<unknown>>(`/wishlist/${product.id}`, { method: "DELETE" });
        showToast("Đã xóa khỏi yêu thích.", "success");
      } else {
        await apiFetch<ApiEnvelope<unknown>>("/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId: product.id, quantity: 1 }),
        });
        showToast("Đã lưu vào yêu thích.", "success");
      }
    } catch (error) {
      setIsWishlisted(was);
      showToast(error instanceof Error ? error.message : "Không thể lưu.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  const walletState =
    walletBalance === null ? "loading" :
    walletBalance >= product.price ? "ok" : "low";

  return (
    <aside className="pp" aria-label="Mua hàng">
      {/* Image */}
      <div className="pp__visual">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="pp__visual-img" />
        ) : (
          <span className="pp__visual-placeholder">{product.type}</span>
        )}
      </div>

      {/* Type label */}
      <p className="pp__type">{productTypeLabel(product.type)} · bàn giao số</p>

      {/* Price */}
      <div className="pp__price-row">
        <strong className="pp__price">{formatCurrency(product.price)}</strong>
        <span className="pp__unit">/{product.type.toLowerCase()}</span>
      </div>

      {/* Rating */}
      <div className="pp__rating">
        <Star size={13} fill="currentColor" className="pp__rating-star star-yellow" />
        <span>{liveRating > 0 ? liveRating.toFixed(1) : "0"}</span>
        <span className="pp__rating-count">· {liveReviewsCount} đánh giá</span>
      </div>

      {/* Details */}
      <dl className="pp__dl">
        <div className="pp__dl-row">
          <dt>Tồn kho</dt>
          <dd className={isAvailable ? "pp__dl-value--live" : "pp__dl-value--out"}>
            {isAvailable ? `${liveStock} sản phẩm` : "Hết hàng"}
          </dd>
        </div>
        <div className="pp__dl-row">
          <dt>Người bán</dt>
          <dd>{product.sellerName ?? "Marketplace"}</dd>
        </div>
        <div className="pp__dl-row">
          <dt>Thanh toán</dt>
          <dd>Ví web nội bộ</dd>
        </div>
      </dl>

      {/* Wallet balance */}
      <div className={`pp__wallet pp__wallet--${walletState}`}>
        <Wallet size={13} />
        <span>
          {walletBalance !== null
            ? formatCurrency(walletBalance)
            : "Đang tải số dư..."}
        </span>
        {walletState === "low" && (
          <span className="pp__wallet-note">· Chưa đủ số dư</span>
        )}
        {walletState === "ok" && (
          <span className="pp__wallet-note">· Đủ để thanh toán</span>
        )}
      </div>

      {/* Actions */}
      <div className="pp__actions">
        {isAuthenticated ? (
          <Link
            href={checkoutHref}
            className={`pp__btn-primary${!isAvailable || !hasEnoughWallet ? " is-disabled" : ""}`}
            aria-disabled={!isAvailable || !hasEnoughWallet}
          >
            <Zap size={15} />
            Mua ngay bằng ví
          </Link>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(checkoutHref)}`}
            className="pp__btn-primary"
          >
            <LockKeyhole size={15} />
            Đăng nhập để mua
          </Link>
        )}

        <button
          type="button"
          className="pp__btn-secondary"
          onClick={addToCart}
          disabled={!isAvailable || isBusy}
        >
          <ShoppingCart size={15} />
          Thêm vào giỏ
        </button>

        <button
          type="button"
          className={`pp__btn-wishlist${isWishlisted ? " is-active" : ""}`}
          onClick={toggleWishlist}
          disabled={isBusy}
        >
          <Heart size={15} fill={isWishlisted ? "currentColor" : "none"} />
          {isWishlisted ? "Đã lưu vào yêu thích" : "Lưu vào yêu thích"}
        </button>
      </div>
    </aside>
  );
}
