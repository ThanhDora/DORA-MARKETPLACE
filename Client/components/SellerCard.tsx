"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Store, ArrowRight, Package, ShoppingBag } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

type SellerInfo = {
  id: number;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  _count: { products: number; orders: number };
};

type Props = {
  sellerId: number;
  sellerName: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function resolveAvatar(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  try {
    const origin = new URL(API_BASE_URL).origin;
    if (raw.startsWith("/api/")) return `${origin}${raw}`;
    if (raw.startsWith("/uploads/")) return `${origin}/api${raw}`;
  } catch {}
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function SellerCard({ sellerId, sellerName }: Props) {
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/users/${sellerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => json?.data && setSeller(json.data))
      .catch(() => {});
  }, [sellerId]);

  const avatarUrl = avatarErr ? null : resolveAvatar(seller?.avatar);
  const displayName = seller?.name ?? sellerName;
  const productCount = seller?._count?.products ?? null;

  return (
    <Link href={`/users/${sellerId}`} className="pd-seller-card" prefetch={false}>
      {/* Avatar */}
      <div className="pd-seller-card__avatar">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="pd-seller-card__avatar-img"
            onError={() => setAvatarErr(true)}
          />
        ) : (
          <span className="pd-seller-card__avatar-initials">{initials(displayName)}</span>
        )}
      </div>

      {/* Info */}
      <div className="pd-seller-card__info">
        <span className="pd-seller-card__role">
          <Store size={11} />
          Người bán
        </span>
        <strong className="pd-seller-card__name">{displayName}</strong>
        {seller && (
          <div className="pd-seller-card__stats">
            <span className="pd-seller-card__stat">
              <Package size={11} />
              {productCount ?? 0} sản phẩm
            </span>
            <span className="pd-seller-card__stat-sep" />
            <span className="pd-seller-card__stat">
              <ShoppingBag size={11} />
              {seller._count.orders} đơn
            </span>
          </div>
        )}
        {!seller && (
          <span className="pd-seller-card__loading">Đang tải…</span>
        )}
      </div>

      {/* CTA */}
      <span className="pd-seller-card__cta">
        Xem cửa hàng
        <ArrowRight size={14} strokeWidth={2} />
      </span>
    </Link>
  );
}
