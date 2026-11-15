import type { MetadataRoute } from "next";
import { getCategories, getProductSlugs } from "@/lib/catalog/queries";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProductSlugs(), getCategories()]);

  const entry = (path: string, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}/vi${path}`,
    lastModified,
    alternates: { languages: { vi: `${siteUrl}/vi${path}`, en: `${siteUrl}/en${path}` } },
  });

  return [
    entry(""),
    entry("/products"),
    ...categories.map((c) => entry(`/products?category=${c.slug}`)),
    ...products.map((p) => entry(`/products/${p.slug}`, p.updatedAt)),
  ];
}
