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
    if (!isAuthenticated) {
      showToast("Đăng nhập để thêm vào giỏ.", "error");
      return;
    }
    if (!isNumericId(product.id)) {
      showToast("Sản phẩm demo, cần backend để thao tác.", "error");
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
      showToast(error instanceof Error ? error.message : "Thao tác thất bại.", "error");
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
      showToast("Sản phẩm demo, cần backend để thao tác.", "error");
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
          body: JSON.stringify({ productId: product.id, quantity: 1 }),
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
    <aside className="checkout-card purchase-panel" aria-label="Tóm tắt mua hàng">
      <div className="checkout-card__visual grid place-items-center overflow-hidden text-primary bg-neutral border border-border rounded-md transition-all hover:border-tertiary/35 product-visual--large">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} />
        ) : (
          <span>{product.type}</span>
        )}
      </div>
      <p className="checkout-card__label">{productTypeLabel(product.type)} · bàn giao số</p>
      <strong>{formatCurrency(product.price)}</strong>
      <span>/{product.type.toLowerCase()}</span>
      <dl>
        <div>
          <dt>Tồn kho</dt>
          <dd>{isAvailable ? `${liveStock} sản phẩm` : "Hết hàng"}</dd>
        </div>
        <div>
          <dt>Người bán</dt>
          <dd>{product.sellerName ?? "Marketplace"}</dd>
        </div>
        <div>
          <dt>Thanh toán</dt>
          <dd>Ví web nội bộ</dd>
        </div>
      </dl>
      <div className={`mt-2 rounded-[12px] border p-3 text-[12px] font-bold ${
        walletBalance === null
          ? "border-border bg-neutral text-secondary"
          : walletBalance >= product.price
            ? "border-success/30 bg-success/10 text-success"
            : "border-danger/30 bg-danger/10 text-danger"
      }`}>
        <div className="flex items-center gap-1.5">
          <Wallet size={14} />
          <span>Số dư ví: {walletBalance !== null ? formatCurrency(walletBalance) : "Đang tải..."}</span>
        </div>
        {walletBalance === null ? (
          <p className="m-0 mt-1 text-[11px]">Hệ thống sẽ kiểm tra số dư ví khi xác nhận checkout.</p>
        ) : walletBalance < product.price ? (
          <p className="m-0 mt-1 text-[11px]">Số dư chưa đủ cho sản phẩm này.</p>
        ) : (
          <p className="m-0 mt-1 text-[11px]">Đủ số dư để thanh toán ngay.</p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-4 text-sm font-bold text-secondary">
        <Star size={14} fill="currentColor" className="text-yellow-500" />
        <span>{liveRating > 0 ? liveRating.toFixed(1) : "0"} · {liveReviewsCount} đánh giá</span>
      </div>
      <div className="flex flex-col items-stretch gap-2.5 mt-5">
        {isAuthenticated ? (
          <Link
            href={checkoutHref}
            className={isAvailable && hasEnoughWallet ? "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary" : "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary is-disabled"}
            aria-disabled={!isAvailable || !hasEnoughWallet}
          >
            <Zap size={17} />
            Mua ngay bằng ví
          </Link>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(checkoutHref)}`} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            <LockKeyhole size={17} />
            Đăng nhập để mua
          </Link>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <button
            type="button"
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface"
            onClick={addToCart}
            disabled={!isAvailable || isBusy}
          >
            <ShoppingCart size={17} />
            Thêm vào giỏ
          </button>
          <button
            type="button"
            className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface ${isWishlisted ? "wishlist-active" : ""}`}
            onClick={toggleWishlist}
            disabled={isBusy}
          >
            <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} className={isWishlisted ? "heart-filled" : ""} />
            {isWishlisted ? "Đã lưu" : "Lưu"}
          </button>
        </div>
      </div>
    </aside>
  );
}
