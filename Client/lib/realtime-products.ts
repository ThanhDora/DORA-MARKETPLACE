import {
  normalizeProduct,
  requestJson,
  toQuery,
  type ApiList,
  type BackendProduct,
  type StoreProduct,
} from "@/lib/api";

type ProductMetricsSnapshot = {
  productId: string;
  stock?: number;
  soldCount?: number;
  viewCount?: number;
  rating?: number;
  reviewsCount?: number;
};

type RealtimeProduct = StoreProduct & {
  realtimeIndex: number;
};

export type ProductCollectionQuery = Record<string, string | number | undefined>;

export function applyRealtimeProducts(
  products: StoreProduct[],
  stockUpdates: Record<string, number>,
  productMetrics: Record<string, ProductMetricsSnapshot>,
  productUpdates?: Record<string, { name?: string; price?: number; images?: string[]; description?: string; slug?: string }>,
): RealtimeProduct[] {
  return products.map((product, index) => {
    const liveMetrics = productMetrics[product.id];
    const liveStock = stockUpdates[product.id] ?? liveMetrics?.stock ?? product.stock;
    const liveProduct = productUpdates?.[product.id];

    return {
      ...product,
      ...(liveProduct && {
        name: liveProduct.name ?? product.name,
        price: liveProduct.price ?? product.price,
        images: liveProduct.images ?? product.images,
        description: liveProduct.description ?? product.description,
        slug: liveProduct.slug ?? product.slug,
      }),
      stock: liveStock,
      soldCount: liveMetrics?.soldCount ?? product.soldCount,
      viewCount: liveMetrics?.viewCount ?? product.viewCount,
      rating: liveMetrics?.rating ?? product.rating,
      reviewsCount: liveMetrics?.reviewsCount ?? product.reviewsCount,
      realtimeIndex: index,
    };
  });
}

export function sortProductsByAvailability(products: RealtimeProduct[]) {
  return [...products].sort((left, right) => {
    const availabilityGap = Number(right.stock > 0) - Number(left.stock > 0);
    if (availabilityGap !== 0) return availabilityGap;
    return left.realtimeIndex - right.realtimeIndex;
  });
}

export function sortProductsForFeatured(products: RealtimeProduct[]) {
  return [...products].sort((left, right) => {
    const availabilityGap = Number(right.stock > 0) - Number(left.stock > 0);
    if (availabilityGap !== 0) return availabilityGap;
    if (right.soldCount !== left.soldCount) return right.soldCount - left.soldCount;
    if (right.rating !== left.rating) return right.rating - left.rating;
    if (right.viewCount !== left.viewCount) return right.viewCount - left.viewCount;
    return left.realtimeIndex - right.realtimeIndex;
  });
}

export function sortProductsForLeaderboard(products: RealtimeProduct[]) {
  return [...products].sort((left, right) => {
    if (right.soldCount !== left.soldCount) return right.soldCount - left.soldCount;
    if (right.rating !== left.rating) return right.rating - left.rating;
    if (right.viewCount !== left.viewCount) return right.viewCount - left.viewCount;
    if (right.stock !== left.stock) return right.stock - left.stock;
    return left.realtimeIndex - right.realtimeIndex;
  });
}

export async function fetchFreshProducts(params: ProductCollectionQuery) {
  try {
    const response = await requestJson<ApiList<BackendProduct>>(`/products${toQuery(params)}`, {
      cache: "no-store",
      notifySuccess: false,
    });
    return response.data.map(normalizeProduct);
  } catch {
    return null;
  }
}
