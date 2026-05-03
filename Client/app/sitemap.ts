import type { MetadataRoute } from "next";
import { products } from "@/lib/catalog";

const baseUrl = "https://dora-marketplace.local";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/catalog`,
      lastModified: new Date(),
    },
    ...products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: new Date(),
    })),
  ];
}
