import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ProductCardData } from "@/lib/catalog/types";
import { ProductCard } from "./product-card";

type Props = {
  products: ProductCardData[];
  locale: Locale;
  dict: Dictionary;
  /** Prioritize the first row's images (the LCP image) on pages where the grid is at the top. */
  priorityCount?: number;
};

export function ProductGrid({ products, locale, dict, priorityCount = 0 }: Props) {
  const labels = {
    from: dict.common.from,
    soldOut: dict.common.soldOut,
    sale: dict.common.sale,
    salePercent: dict.product.sale,
  };
  return (
    <ul role="list" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} locale={locale} labels={labels} priority={i < priorityCount} />
      ))}
    </ul>
  );
}
