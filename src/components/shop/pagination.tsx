import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { listParamsToSearch, type ListParams } from "@/lib/catalog/parse-list-params";
import { cn } from "@/lib/utils";

/** Page numbers to show: the first, the last, and a window around the current page, with gaps as null. */
export function pageWindow(current: number, total: number, radius = 1): (number | null)[] {
  const pages = new Set([1, total]);
  for (let p = current - radius; p <= current + radius; p++) if (p >= 1 && p <= total) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

type Props = { locale: Locale; dict: Dictionary; params: ListParams; page: number; pageCount: number };

const base =
  "inline-flex size-11 items-center justify-center rounded-full border text-sm transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function Pagination({ locale, dict, params, page, pageCount }: Props) {
  if (pageCount <= 1) return null;
  const href = (p: number) => `${localePath(locale, "/products")}${listParamsToSearch(params, { page: p })}`;
  const t = dict.products.pagination;

  return (
    <nav aria-label={t.label} className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label={t.previous} rel="prev" className={cn(base, "border-border bg-surface hover:border-primary")}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(base, "border-border opacity-40")}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {pageWindow(page, pageCount).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-label={p === page ? format(t.current, { page: p, total: pageCount }) : format(t.page, { page: p })}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              base,
              p === page ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary",
            )}
          >
            {p}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link href={href(page + 1)} aria-label={t.next} rel="next" className={cn(base, "border-border bg-surface hover:border-primary")}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(base, "border-border opacity-40")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
