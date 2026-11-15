import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { localePath } from "@/i18n/config";
import { pick } from "@/i18n/format";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getProductDetail, getProductSlugs } from "@/lib/catalog/queries";
import type { ProductDetailData } from "@/lib/catalog/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const product = await getProductDetail(slug);
  if (!product) return {};

  const name = pick(locale, product.nameVi, product.nameEn);
  const description = pick(locale, product.descriptionVi, product.descriptionEn) ?? `${product.brandName} ${name}`;
  const path = `/products/${product.slug}`;
  const image = product.images.find((i) => !i.variantId && !i.colorId) ?? product.images[0];

  return {
    title: name,
    description: description.slice(0, 160),
    alternates: {
      canonical: localePath(locale, path),
      languages: { vi: localePath("vi", path), en: localePath("en", path), "x-default": localePath("vi", path) },
    },
    openGraph: { title: name, description: description.slice(0, 160), type: "website", images: image ? [image.url] : undefined },
  };
}

// Known products are prerendered at build time; products added later render on first request.
export async function generateStaticParams() {
  const products = await getProductSlugs();
  // Cache Components needs at least one sample. With an empty catalog the sample renders the not-found page.
  return products.length > 0 ? products.map(({ slug }) => ({ slug })) : [{ slug: "-" }];
}

export default async function ProductPage({ params }: PageProps<"/[lang]/products/[slug]">) {
  const [{ slug }, dict, locale] = await Promise.all([params, getDictionary(), getLocale()]);
  // Checked before anything streams, so an unknown product gets a real 404 status, not a soft 404.
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const name = pick(locale, product.nameVi, product.nameEn);
  const description = pick(locale, product.descriptionVi, product.descriptionEn);
  const categoryName = pick(locale, product.category.nameVi, product.category.nameEn);
  const crumbs = [
    { href: localePath(locale), label: dict.common.home },
    { href: localePath(locale, "/products"), label: dict.products.title },
    { href: localePath(locale, `/products?category=${product.category.slug}`), label: categoryName },
  ];

  return (
    <div className="mx-auto w-[min(1360px,92vw)] pt-8">
      <JsonLd product={product} name={name} description={description} />

      <nav aria-label={dict.product.breadcrumb} className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {crumbs.map((c) => (
            <li key={c.href} className="flex items-center gap-2">
              <Link href={c.href} className="rounded-sm hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {c.label}
              </Link>
              <span aria-hidden>/</span>
            </li>
          ))}
          <li aria-current="page" className="text-foreground">
            {name}
          </li>
        </ol>
      </nav>

      <ProductPurchase
        product={product}
        locale={locale}
        cartHref={localePath(locale, "/cart")}
        labels={dict.product}
        fromLabel={dict.common.from}
      />

      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-14">
        {description && (
          <section aria-labelledby="product-description">
            <h2 id="product-description" className="mb-4 text-2xl font-medium">
              {dict.product.description}
            </h2>
            <div className="space-y-4 leading-relaxed text-muted-foreground">
              {description.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}
        {product.specs.length > 0 && (
          <section aria-labelledby="product-specs">
            <h2 id="product-specs" className="mb-4 text-2xl font-medium">
              {dict.product.specs}
            </h2>
            <dl className="divide-y divide-border rounded-md bg-surface px-5 shadow-soft">
              {product.specs.map((s) => (
                <div key={s.key} className="flex justify-between gap-4 py-3.5 text-sm">
                  <dt className="text-muted-foreground">{pick(locale, s.labelVi, s.labelEn)}</dt>
                  <dd className="text-right font-medium">{pick(locale, s.valueVi, s.valueEn)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

/** Structured data for search engines. `<` is escaped so product text cannot close the script tag. */
function JsonLd({ product, name, description }: { product: ProductDetailData; name: string; description: string | null }) {
  const prices = product.variants.map((v) => v.price);
  const low = prices.length ? Math.min(...prices) : product.price;
  const high = prices.length ? Math.max(...prices) : product.price;
  const inStock = product.variants.some((v) => v.stock > 0);
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description ?? undefined,
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: product.brandName },
    image: product.images.map((i) => new URL(i.url, siteUrl).toString()),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "VND",
      lowPrice: low,
      highPrice: high,
      offerCount: product.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
