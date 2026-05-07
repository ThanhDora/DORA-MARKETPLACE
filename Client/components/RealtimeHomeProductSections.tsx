"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, CreditCard, ShieldCheck, TrendingUp } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useRealtime } from "@/components/RealtimeProvider";
import { isNumericId, type StoreProduct } from "@/lib/api";
import {
  applyRealtimeProducts,
  fetchFreshProducts,
  sortProductsForFeatured,
  sortProductsForLeaderboard,
} from "@/lib/realtime-products";

type RealtimeHomeProductSectionsProps = {
  initialProducts: StoreProduct[];
};

function getProductHref(product: StoreProduct) {
  return `/products/${isNumericId(product.id) ? product.id : product.slug}`;
}

function useHomeProducts(initialProducts: StoreProduct[]) {
  const { stockUpdates, productMetrics, productFeedVersion, productUpdates } = useRealtime();
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (productFeedVersion === 0) return;

    let isCancelled = false;
    const timer = window.setTimeout(() => {
      void fetchFreshProducts({ limit: 8, sortBy: "soldCount", sortOrder: "desc" }).then((nextProducts) => {
        if (!nextProducts || isCancelled) return;
        setProducts(nextProducts);
      });
    }, 700);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [productFeedVersion]);

  return useMemo(
    () => applyRealtimeProducts(products, stockUpdates, productMetrics, productUpdates),
    [productMetrics, products, stockUpdates, productUpdates],
  );
}

export function RealtimeHomeLeaderboard({ initialProducts }: RealtimeHomeProductSectionsProps) {
  const liveProducts = useHomeProducts(initialProducts);
  const topSellingProducts = useMemo(() => sortProductsForLeaderboard(liveProducts).slice(0, 5), [liveProducts]);
  const totalSold = topSellingProducts.reduce((total, product) => total + product.soldCount, 0);
  const peakSold = Math.max(...topSellingProducts.map((product) => product.soldCount), 1);

  return (
    <div className="ldb-panel" aria-label="Bảng xếp hạng sản phẩm bán chạy nhất">

      {/* Editorial header */}
      <div className="ldb-header">
        <div className="ldb-header__top">
          <span className="ldb-live-badge">
            <span className="ldb-live-dot" aria-hidden="true" />
            Realtime
          </span>
          <TrendingUp size={15} className="ldb-header__icon" aria-hidden="true" />
        </div>
        <h2 className="ldb-header__title">Bảng<br/>xếp hạng</h2>
        <p className="ldb-header__sub">Top sản phẩm bán chạy</p>
        <div className="ldb-header__nums" aria-hidden="true">
          <span>01</span><span>02</span><span>03</span>
        </div>
      </div>

      {/* Stats */}
      <div className="ldb-stats">
        <div className="ldb-stat">
          <Activity size={13} aria-hidden="true" />
          <div>
            <b>{totalSold || 120}</b>
            <small>lượt mua</small>
          </div>
        </div>
        <div className="ldb-stat">
          <TrendingUp size={13} aria-hidden="true" />
          <div>
            <b>{peakSold}</b>
            <small>cao nhất</small>
          </div>
        </div>
      </div>

      {/* Leaderboard rows */}
      <div className="ldb-list">
        {topSellingProducts.map((product, index) => {
          const soldLevel = Math.min(100, Math.max(8, Math.round((product.soldCount / peakSold) * 100)));
          const rankMedal = ["🥇", "🥈", "🥉"][index] ?? null;
          return (
            <Link
              key={product.id}
              href={getProductHref(product)}
              className={`ldb-row ldb-row--${index + 1}`}
              style={{
                "--sold-pct": `${soldLevel}%`,
                "--row-i": index,
              } as CSSProperties}
            >
              <span className="ldb-row__rank" aria-label={`Hạng ${index + 1}`}>
                {rankMedal ?? <span>{index + 1}</span>}
              </span>
              <span className="ldb-row__visual" aria-hidden="true">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0]}
                    alt=""
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                    onError={(e) => { e.currentTarget.src = ""; e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span className="ldb-row__type-badge">{product.type.slice(0, 3)}</span>
                )}
              </span>
              <span className="ldb-row__body">
                <strong>{product.name}</strong>
                <small>{product.type} · {product.sellerName ?? "Dora"}</small>
                <span className="ldb-row__bar" aria-hidden="true"><span /></span>
              </span>
              <span className="ldb-row__score">
                <b>{product.soldCount}</b>
                <small>lượt mua</small>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="ldb-footer">
        <span><ShieldCheck size={14} aria-hidden="true" />Seller đã duyệt</span>
        <span><CreditCard size={14} aria-hidden="true" />Thanh toán bảo mật</span>
      </div>
    </div>
  );
}

export function RealtimeFeaturedProductsSection({ initialProducts }: RealtimeHomeProductSectionsProps) {
  const liveProducts = useHomeProducts(initialProducts);
  const featuredProducts = useMemo(() => sortProductsForFeatured(liveProducts).slice(0, 8), [liveProducts]);

  return (
    <section className="px-inline py-block featured-section">
      <div className="anthro-section-head">
        <div>
          <p>Nổi bật</p>
          <h2>Sản phẩm đang được mua nhiều</h2>
          <p>Hiển thị tồn kho, người bán, đánh giá và nút thêm giỏ hàng để người mua quyết định nhanh.</p>
        </div>
        <Link href="/catalog?sortBy=soldCount&sortOrder=desc" className="anthro-button anthro-button--ghost">
          Lọc bán chạy
        </Link>
      </div>
      <div className="product-card-grid">
        {featuredProducts.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 2} />
        ))}
      </div>
    </section>
  );
}
