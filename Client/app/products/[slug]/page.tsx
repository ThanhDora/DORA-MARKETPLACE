import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/ProductDetailClient";
import {
  fallbackStoreProducts,
  getProduct,
  getReviews,
} from "@/lib/api";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 60;

export function generateStaticParams() {
  return fallbackStoreProducts.map((product) => ({
    slug: product.slug,
  }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Không tìm thấy sản phẩm" };
  }

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const reviewData = await getReviews(product.id);

  return (
    <main>
      <ProductDetailClient
        product={product}
        initialReviews={reviewData.data}
        initialAverageRating={reviewData.stats?.averageRating ?? product.rating}
      />
    </main>
  );
}
