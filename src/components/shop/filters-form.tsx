import { localePath, type Locale } from "@/i18n/config";
import { pick } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { AutoSubmitForm } from "./auto-submit-form";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ListParams } from "@/lib/catalog/parse-list-params";
import type { CategoryData, ListFacets } from "@/lib/catalog/types";
import { formatVnd } from "@/lib/format";

type Props = {
  /** Apply as soon as an option is chosen (desktop). Otherwise the Apply button, kept visible at the bottom, applies. */
  auto?: boolean;
  idPrefix: string;
  locale: Locale;
  dict: Dictionary;
  params: ListParams;
  facets: ListFacets;
  categories: CategoryData[];
};

const groupTitle = "mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase";
const field =
  "h-11 w-full rounded-sm border border-border bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";
const choice = "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm hover:bg-secondary";
const box = "size-4 accent-gold";

/** Plain GET form (no JavaScript needed). The same form is rendered for desktop and mobile, so ids carry a prefix. */
export function FiltersForm({ auto = false, idPrefix, locale, dict, params, facets, categories }: Props) {
  const f = dict.products.filters;
  const top = categories.filter((c) => c.parentSlug === null);
  const childrenOf = (slug: string) => categories.filter((c) => c.parentSlug === slug);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <AutoSubmitForm action={localePath(locale, "/products")} auto={auto} className="space-y-7">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.sort !== "new" && <input type="hidden" name="sort" value={params.sort} />}

      <fieldset>
        <legend className={groupTitle}>{f.category}</legend>
        <label className={choice}>
          <input type="radio" name="category" value="" defaultChecked={!params.category} className={box} />
          {f.allCategories}
        </label>
        {top.map((c) => (
          <div key={c.slug}>
            <label className={choice}>
              <input type="radio" name="category" value={c.slug} defaultChecked={params.category === c.slug} className={box} />
              {pick(locale, c.nameVi, c.nameEn)}
            </label>
            {childrenOf(c.slug).map((child) => (
              <label key={child.slug} className={`${choice} pl-8`}>
                <input
                  type="radio"
                  name="category"
                  value={child.slug}
                  defaultChecked={params.category === child.slug}
                  className={box}
                />
                {pick(locale, child.nameVi, child.nameEn)}
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      {facets.brands.length > 0 && (
        <fieldset>
          <legend className={groupTitle}>{f.brand}</legend>
          {facets.brands.map((b) => (
            <label key={b.slug} className={choice}>
              <input type="checkbox" name="brand" value={b.slug} defaultChecked={params.brands.includes(b.slug)} className={box} />
              {b.name}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className={groupTitle}>{f.price}</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={id("min")} className="sr-only">
              {f.minPrice}
            </label>
            <input
              id={id("min")}
              name="minPrice"
              type="number"
              inputMode="numeric"
              min={0}
              step={10000}
              defaultValue={params.minPrice}
              placeholder={facets.priceMin !== null ? formatVnd(facets.priceMin) : f.minPrice}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={id("max")} className="sr-only">
              {f.maxPrice}
            </label>
            <input
              id={id("max")}
              name="maxPrice"
              type="number"
              inputMode="numeric"
              min={0}
              step={10000}
              defaultValue={params.maxPrice}
              placeholder={facets.priceMax !== null ? formatVnd(facets.priceMax) : f.maxPrice}
              className={field}
            />
          </div>
        </div>
      </fieldset>

      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className={groupTitle}>{f.size}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <label
                key={`${s.type}-${s.label}`}
                className="has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-sm border border-border px-3 text-sm transition-colors duration-300 hover:border-primary"
              >
                <input type="checkbox" name="size" value={s.label} defaultChecked={params.sizes.includes(s.label)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className={groupTitle}>{f.color}</legend>
          {facets.colors.map((c) => (
            <label key={c.nameVi} className={choice}>
              <input type="checkbox" name="color" value={c.nameVi} defaultChecked={params.colors.includes(c.nameVi)} className={box} />
              <span
                aria-hidden
                className="size-4 rounded-full ring-1 ring-border"
                style={{ backgroundColor: c.hex ?? "#ccc" }}
              />
              {pick(locale, c.nameVi, c.nameEn)}
            </label>
          ))}
        </fieldset>
      )}

      <div className={cn("flex gap-2", !auto && "sticky bottom-0 -mx-4 border-t border-border bg-surface px-4 py-3")}>
        <button
          type="submit"
          className="h-11 flex-1 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {f.apply}
        </button>
        <a
          href={localePath(locale, "/products")}
          className="grid h-11 place-items-center rounded-full border border-border px-5 text-sm transition-colors duration-300 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {f.reset}
        </a>
      </div>
    </AutoSubmitForm>
  );
}
