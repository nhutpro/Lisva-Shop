import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { SORTS, listParamsToSearch, type ListParams } from "@/lib/catalog/parse-list-params";
import { cn } from "@/lib/utils";

export function SortLinks({ locale, dict, params }: { locale: Locale; dict: Dictionary; params: ListParams }) {
  const labels = { new: dict.products.sort.new, "price-asc": dict.products.sort.priceAsc, "price-desc": dict.products.sort.priceDesc };

  return (
    <nav aria-label={dict.products.sort.label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{dict.products.sort.label}:</span>
      {SORTS.map((sort) => (
        <Link
          key={sort}
          href={`${localePath(locale, "/products")}${listParamsToSearch(params, { sort, page: 1 })}`}
          aria-current={params.sort === sort ? "true" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            params.sort === sort
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface hover:border-primary",
          )}
        >
          {labels[sort]}
        </Link>
      ))}
    </nav>
  );
}
