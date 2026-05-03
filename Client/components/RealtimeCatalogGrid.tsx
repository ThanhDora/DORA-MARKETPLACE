"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { useRealtime } from "@/components/RealtimeProvider";
import {
  applyRealtimeProducts,
  fetchFreshProducts,
  sortProductsByAvailability,
  type ProductCollectionQuery,
} from "@/lib/realtime-products";
import type { StoreProduct } from "@/lib/api";

type RealtimeCatalogGridProps = {
  initialProducts: StoreProduct[];
  query: ProductCollectionQuery;
};

export function RealtimeCatalogGrid({ initialProducts, query }: RealtimeCatalogGridProps) {
  const { stockUpdates, productMetrics, productFeedVersion, productUpdates } = useRealtime();
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (productFeedVersion === 0) return;

    let isCancelled = false;
    const timer = window.setTimeout(() => {
      void fetchFreshProducts(query).then((nextProducts) => {
        if (!nextProducts || isCancelled) return;
        setProducts(nextProducts);
      });
    }, 700);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [productFeedVersion, query]);

  useEffect(() => {
    let isCancelled = false;
    const timer = window.setTimeout(() => {
      void fetchFreshProducts(query).then((nextProducts) => {
        if (!nextProducts || isCancelled) return;
        setProducts(nextProducts);
      });
    }, 2000);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const sortedProducts = useMemo(() => {
    const liveProducts = applyRealtimeProducts(products, stockUpdates, productMetrics, productUpdates);
    return sortProductsByAvailability(liveProducts);
  }, [productMetrics, products, stockUpdates, productUpdates]);

  return (
    <div className="product-card-grid">
      {sortedProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
