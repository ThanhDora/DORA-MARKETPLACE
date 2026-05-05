export const SELLER_PRODUCT_PREVIEW_LIMIT = 5;

export function getUniqueSellerProducts<T extends { id: string | number }>(products: T[]) {
  const seenProductIds = new Set<string>();
  return products.filter((product) => {
    const productId = String(product.id);
    if (seenProductIds.has(productId)) {
      return false;
    }
    seenProductIds.add(productId);
    return true;
  });
}

export function getVisibleSellerProducts<T extends { id: string | number }>(
  products: T[],
  showAll: boolean,
  limit = SELLER_PRODUCT_PREVIEW_LIMIT,
) {
  const uniqueProducts = getUniqueSellerProducts(products);

  if (showAll || uniqueProducts.length <= limit) {
    return {
      visibleProducts: uniqueProducts,
      hiddenCount: 0,
      canShowMore: false,
    };
  }

  return {
    visibleProducts: uniqueProducts.slice(0, limit),
    hiddenCount: uniqueProducts.length - limit,
    canShowMore: true,
  };
}
