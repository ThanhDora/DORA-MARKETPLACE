"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

/* ── Animated counting number ── */
function useAnimatedNumber(value: number, duration = 650) {
  const [display, setDisplay] = useState(value);
  const raf = useRef(0);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (value - from) * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return display;
}

/* ── Flash on value change ── */
function useFlash(value: number) {
  const [active, setActive] = useState(false);
  const prev = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setActive(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 900);
    }
    return () => clearTimeout(timer.current);
  }, [value]);
  return active;
}

/* ── Single leaderboard row with smooth transitions ── */
function LdbRow({
  product, index, peakSold,
}: {
  product: StoreProduct; index: number; peakSold: number;
}) {
  const soldLevel = Math.min(100, Math.max(4, Math.round((product.soldCount / peakSold) * 100)));
  const [barWidth, setBarWidth] = useState(0);
  const flash = useFlash(product.soldCount);
  const animatedScore = useAnimatedNumber(product.soldCount);
  const rankMedal = ["🥇", "🥈", "🥉"][index] ?? null;
  const isChamp = index === 0;

  /* initial bar grow + smooth update */
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(soldLevel), index * 60 + 120);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBarWidth(soldLevel);
  }, [soldLevel]);

  let statusVariant = "";
  if (product.status === "APPROVED") statusVariant = "success";

  return (
    <Link
      href={`/products/${isNumericId(product.id) ? product.id : product.slug}`}
      className={`ldb-row ldb-row--${index + 1}${flash ? " ldb-row--flash" : ""}`}
      style={{ "--row-i": index } as CSSProperties}
    >
      <span className="ldb-row__rank" aria-label={`Hạng ${index + 1}`}>
        {rankMedal ?? <span>{index + 1}</span>}
      </span>
      <span className="ldb-row__visual" aria-hidden="true">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]} alt=""
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <span className="ldb-row__type-badge">{product.type.slice(0, 3)}</span>
        )}
      </span>
      <span className="ldb-row__body">
        <strong>{product.name}</strong>
        <small>{product.type} · {product.sellerName ?? "Dora"}</small>
        <span className="ldb-row__bar" aria-hidden="true">
          <span
            className="ldb-row__bar-inner"
            style={{ width: `${barWidth}%` }}
          />
        </span>
      </span>
      <span className={`ldb-row__score${isChamp ? " ldb-row__score--champ" : ""}`}>
        <b className={flash ? "ldb-score--flash" : ""}>{animatedScore}</b>
        <small>lượt mua</small>
      </span>
    </Link>
  );
}

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
  const totalSold = topSellingProducts.reduce((s, p) => s + p.soldCount, 0);
  const peakSold = Math.max(...topSellingProducts.map((p) => p.soldCount), 1);

  const animatedTotal = useAnimatedNumber(totalSold || 120);
  const animatedPeak  = useAnimatedNumber(peakSold);

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
            <b>{animatedTotal}</b>
            <small>lượt mua</small>
          </div>
        </div>
        <div className="ldb-stat">
          <TrendingUp size={13} aria-hidden="true" />
          <div>
            <b>{animatedPeak}</b>
            <small>cao nhất</small>
          </div>
        </div>
      </div>

      {/* Leaderboard rows */}
      <div className="ldb-list">
        {topSellingProducts.map((product, index) => (
          <LdbRow key={product.id} product={product} index={index} peakSold={peakSold} />
        ))}
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
