import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FiltersForm } from "@/components/shop/filters-form";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { ProductsSkeleton } from "@/components/shop/products-skeleton";
import { SortLinks } from "@/components/shop/sort-links";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { hasActiveFilters, parseListParams, type RawSearchParams } from "@/lib/catalog/parse-list-params";
import { getCategories, getListFacets, listProducts } from "@/lib/catalog/queries";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return {
    title: dict.meta.productsTitle,
    description: dict.meta.productsDescription,
    alternates: {
      canonical: localePath(locale, "/products"),
      languages: { vi: localePath("vi", "/products"), en: localePath("en", "/products") },
    },
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/[lang]/products">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto w-[min(1360px,92vw)] pt-10">
      <h1 className="mb-2 text-4xl font-medium sm:text-5xl">{dict.products.title}</h1>
      {/* searchParams is a runtime value, so everything that reads it streams inside Suspense. */}
      <Suspense fallback={<ProductsSkeleton label={dict.products.loading} />}>
        <ProductsContent searchParams={searchParams} locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}

async function ProductsContent({
  searchParams,
  locale,
  dict,
}: {
  searchParams: Promise<RawSearchParams>;
  locale: Locale;
  dict: Dictionary;
}) {
  const params = parseListParams(await searchParams);
  const [result, facets, categories] = await Promise.all([
    listProducts(params),
    getListFacets(params.category),
    getCategories(),
  ]);
  const filtered = hasActiveFilters(params);
  const filterProps = { locale, dict, params, facets, categories };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <p aria-live="polite" className="text-muted-foreground">
          {params.q ? `${format(dict.products.resultFor, { query: params.q })} · ` : ""}
          {format(dict.products.resultCount, { count: result.total })}
        </p>
        <SortLinks locale={locale} dict={dict} params={params} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside aria-label={dict.products.filters.title}>
          <details className="rounded-md border border-border bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              {dict.products.filters.open}
            </summary>
            <div className="border-t border-border p-4">
              <FiltersForm idPrefix="m" {...filterProps} />
            </div>
          </details>
          <div className="hidden lg:block">
            <FiltersForm auto idPrefix="d" {...filterProps} />
          </div>
        </aside>

        <section aria-label={dict.products.title}>
          {result.items.length > 0 ? (
            <>
              <ProductGrid products={result.items} locale={locale} dict={dict} priorityCount={4} />
              <Pagination locale={locale} dict={dict} params={params} page={result.page} pageCount={result.pageCount} />
            </>
          ) : (
            <div className="rounded-lg bg-surface px-6 py-16 text-center shadow-soft">
              <h2 className="text-2xl font-medium">{dict.products.noResultsTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{dict.products.noResultsText}</p>
              {filtered && (
                <Link
                  href={localePath(locale, "/products")}
                  className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {dict.products.clearFilters}
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
