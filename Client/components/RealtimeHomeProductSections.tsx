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
    <div className="inventory-panel inventory-panel--leaderboard" aria-label="Bảng xếp hạng sản phẩm bán chạy nhất">
      <span className="inventory-panel__shine" aria-hidden="true" />
      <div className="inventory-panel__header">
        <video
          className="inventory-panel__header-media"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/rankup.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="leaderboard-stats">
        <span>
          <Activity size={16} />
          {totalSold || 120} lượt mua
        </span>
        <span>
          <TrendingUp size={16} />
          Cao nhất {peakSold} lượt
        </span>
      </div>

      <div className="inventory-panel__list">
        {topSellingProducts.map((product, index) => {
          const soldLevel = Math.min(100, Math.max(10, Math.round((product.soldCount / peakSold) * 100)));
          return (
            <Link
              key={product.id}
              href={getProductHref(product)}
              className="inventory-row"
              style={{
                "--stock-level": `${soldLevel}%`,
                "--row-delay": `${index * 80}ms`,
              } as CSSProperties}
            >
              <span
                className={
                  index === 0
                    ? "inventory-row__rank inventory-row__rank--champion"
                    : "inventory-row__rank inventory-row__rank--plain"
                }
              >
                {index === 0 ? "1" : `${index + 1}`}
              </span>
              <span className="inventory-row__visual" aria-hidden="true">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0]}
                    alt=""
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                ) : (
                  <span>{product.type}</span>
                )}
              </span>
              <span className="inventory-row__body">
                <strong>{product.name}</strong>
                <small>{product.type} · {product.sellerName ?? "Dora MARKETPLACE"}</small>
                <span className="inventory-row__bar" aria-hidden="true">
                  <span />
                </span>
              </span>
              <span className="inventory-row__score">
                <strong>{product.soldCount}</strong>
                <small>lượt mua</small>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="inventory-panel__footer">
        <span>
          <ShieldCheck size={16} />
          Duyệt seller
        </span>
        <span>
          <CreditCard size={16} />
          Nhiều cách thanh toán
        </span>
      </div>
    </div>
  );
}

export function RealtimeFeaturedProductsSection({ initialProducts }: RealtimeHomeProductSectionsProps) {
  const liveProducts = useHomeProducts(initialProducts);
  const featuredProducts = useMemo(() => sortProductsForFeatured(liveProducts).slice(0, 8), [liveProducts]);

  return (
    <section className="px-inline py-block featured-section">
      <div className="grid justify-items-start mb-[34px] grid grid-cols-[minmax(0,1fr)_auto] gap-5 items-end">
        <div>
          <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Nổi bật</p>
          <h2>Sản phẩm đang được mua nhiều</h2>
          <p>Hiển thị tồn kho, người bán, đánh giá và nút thêm giỏ hàng để người mua quyết định nhanh.</p>
        </div>
        <Link href="/catalog?sortBy=soldCount&sortOrder=desc" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface">
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
