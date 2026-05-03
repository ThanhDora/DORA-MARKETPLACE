import type { Metadata } from "next";
import { CheckoutClient } from "@/components/CheckoutClient";
import { fallbackStoreProducts, getProduct } from "@/lib/api";

export const metadata: Metadata = {
  title: "Thanh toán",
  description: "Thanh toán sản phẩm số trên DORA MARKETPLACE.",
};

type CheckoutPageProps = {
  searchParams?: Promise<{
    product?: string;
    items?: string;
  }>;
};

type CheckoutItem = {
  productId: string;
  quantity: number;
};

function parseCheckoutItems(input?: string): CheckoutItem[] {
  if (!input) return [];
  return input
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [productId, rawQty] = segment.split(":");
      const quantity = Math.max(1, Number(rawQty) || 1);
      if (!productId || !/^\d+$/.test(productId)) {
        return null;
      }
      return { productId, quantity };
    })
    .filter((item): item is CheckoutItem => Boolean(item));
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const parsedItems = parseCheckoutItems(params?.items);

  if (parsedItems.length > 0) {
    const products = await Promise.all(parsedItems.map((item) => getProduct(item.productId)));
    const checkoutItems = parsedItems
      .map((item, index) => {
        const product = products[index];
        if (!product) return null;
        return {
          product,
          quantity: Math.min(item.quantity, Math.max(product.stock, 1)),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (checkoutItems.length > 0) {
      return (
        <main>
          <CheckoutClient items={checkoutItems} />
        </main>
      );
    }
  }

  const product = (params?.product ? await getProduct(params.product) : null) ?? fallbackStoreProducts[0];

  return (
    <main>
      <CheckoutClient
        items={[
          {
            product,
            quantity: 1,
          },
        ]}
      />
    </main>
  );
}
