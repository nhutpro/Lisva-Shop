export const SORTS = ["new", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 12;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListParams = {
  q: string;
  category?: string;
  brands: string[];
  sizes: string[];
  colors: string[];
  minPrice?: number;
  maxPrice?: number;
  sort: Sort;
  page: number;
};

const MAX_PRICE = 1_000_000_000;
const MAX_PAGE = 1000;
const MAX_VALUES = 10;

const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const SIZE_LABEL = /^[A-Za-z0-9.\-]{1,12}$/;

const many = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const first = (value: string | string[] | undefined): string | undefined => many(value)[0];

const list = (value: string | string[] | undefined, valid: (s: string) => boolean): string[] => [
  ...new Set(many(value).map((v) => v.trim()).filter(valid)),
].slice(0, MAX_VALUES);

const price = (value: string | string[] | undefined): number | undefined => {
  const raw = first(value)?.trim();
  if (!raw || !/^\d{1,10}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n <= MAX_PRICE ? n : undefined;
};

/** Turns an untrusted query string into safe list parameters. Anything invalid falls back to a default. */
export function parseListParams(raw: RawSearchParams): ListParams {
  const category = first(raw.category)?.trim();
  const sort = first(raw.sort);
  const pageRaw = first(raw.page);
  const page = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Math.min(Math.max(Number(pageRaw), 1), MAX_PAGE) : 1;

  let minPrice = price(raw.minPrice);
  let maxPrice = price(raw.maxPrice);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    q: (first(raw.q) ?? "").trim().slice(0, 80),
    category: category && SLUG.test(category) ? category : undefined,
    brands: list(raw.brand, (s) => SLUG.test(s)),
    sizes: list(raw.size, (s) => SIZE_LABEL.test(s)),
    colors: list(raw.color, (s) => s.length > 0 && s.length <= 40),
    minPrice,
    maxPrice,
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "new",
    page,
  };
}

/** Builds a query string for links, leaving out defaults. Pass overrides to change one thing. */
export function listParamsToSearch(params: ListParams, overrides: Partial<ListParams> = {}): string {
  const p = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (p.q) search.set("q", p.q);
  if (p.category) search.set("category", p.category);
  for (const b of p.brands) search.append("brand", b);
  for (const s of p.sizes) search.append("size", s);
  for (const c of p.colors) search.append("color", c);
  if (p.minPrice !== undefined) search.set("minPrice", String(p.minPrice));
  if (p.maxPrice !== undefined) search.set("maxPrice", String(p.maxPrice));
  if (p.sort !== "new") search.set("sort", p.sort);
  if (p.page > 1) search.set("page", String(p.page));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(p: ListParams): boolean {
  return Boolean(
    p.q || p.category || p.brands.length || p.sizes.length || p.colors.length || p.minPrice !== undefined || p.maxPrice !== undefined,
  );
}
