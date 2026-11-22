import { slugify } from "../slug";
import type { Issue, IssueCode } from "./errors";
import type { ProductEditorData } from "./product-schema";

// Pure helpers behind the product editor. Every edit returns a new draft that is still consistent:
// removing a color also removes its variants, and photos never point at something that is gone.

export type DraftVariant = {
  key: string;
  colorKey: string | null;
  sizeId: string | null;
  sku: string;
  price: string;
  stock: string;
  isActive: boolean;
};
export type DraftColor = {
  key: string;
  nameVi: string;
  nameEn: string;
  hex: string;
};
export type DraftImage = {
  url: string;
  altVi: string;
  altEn: string;
  colorKey: string | null;
  variantKey: string | null;
};
export type DraftSpec = {
  labelVi: string;
  labelEn: string;
  valueVi: string;
  valueEn: string;
};

/** The editor's working copy: numbers are kept as text so half-typed values survive. */
export type Draft = {
  id?: string;
  slug: string;
  categoryId: string;
  brandId: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  price: string;
  compareAtPrice: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  featured: boolean;
  specs: DraftSpec[];
  colors: DraftColor[];
  variants: DraftVariant[];
  images: DraftImage[];
};

const text = (n: number | null) => (n === null ? "" : String(n));

export function toDraft(data: ProductEditorData): Draft {
  return {
    ...data,
    price: text(data.price),
    compareAtPrice: text(data.compareAtPrice),
    variants: data.variants.map((v) => ({
      ...v,
      price: text(v.price),
      stock: String(v.stock),
    })),
  };
}

export function emptyDraft(
  defaults: { categoryId?: string; brandId?: string } = {},
): Draft {
  return {
    slug: "",
    categoryId: defaults.categoryId ?? "",
    brandId: defaults.brandId ?? "",
    nameVi: "",
    nameEn: "",
    descriptionVi: "",
    descriptionEn: "",
    price: "",
    compareAtPrice: "",
    status: "DRAFT",
    featured: false,
    specs: [],
    colors: [],
    variants: [blankVariant("new-variant-0")],
    images: [],
  };
}

const blankVariant = (
  key: string,
  colorKey: string | null = null,
): DraftVariant => ({
  key,
  colorKey,
  sizeId: null,
  sku: "",
  price: "",
  stock: "0",
  isActive: true,
});

/** A key that is not used by any color or variant of the draft. */
export function freshKey(draft: Draft, kind: "color" | "variant"): string {
  const used = new Set([
    ...draft.colors.map((c) => c.key),
    ...draft.variants.map((v) => v.key),
  ]);
  for (let n = 1; ; n++) {
    const key = `new-${kind}-${n}`;
    if (!used.has(key)) return key;
  }
}

/**
 * Adds a color. The first color of a product gives its existing variants that color, so they stay valid
 * (once a product has colors, every variant needs one).
 */
export function addColor(draft: Draft): Draft {
  const key = freshKey(draft, "color");
  const first = draft.colors.length === 0;
  return {
    ...draft,
    colors: [...draft.colors, { key, nameVi: "", nameEn: "", hex: "" }],
    variants: first
      ? draft.variants.map((v) => ({ ...v, colorKey: key }))
      : draft.variants,
  };
}

/** Removes a color together with its variants, and frees the photos that pointed at them. At least one variant always remains. */
export function removeColor(draft: Draft, colorKey: string): Draft {
  const gone = new Set(
    draft.variants.filter((v) => v.colorKey === colorKey).map((v) => v.key),
  );
  const colors = draft.colors.filter((c) => c.key !== colorKey);
  let variants = draft.variants.filter((v) => !gone.has(v.key));
  if (variants.length === 0)
    variants = [
      blankVariant(
        freshKey({ ...draft, colors, variants: [] }, "variant"),
        colors[0]?.key ?? null,
      ),
    ];
  // With no colors left, the remaining variants cannot carry one.
  if (colors.length === 0)
    variants = variants.map((v) => ({ ...v, colorKey: null }));
  return {
    ...draft,
    colors,
    variants,
    images: draft.images.map((i) => ({
      ...i,
      colorKey: i.colorKey === colorKey ? null : i.colorKey,
      variantKey: i.variantKey && gone.has(i.variantKey) ? null : i.variantKey,
    })),
  };
}

export function addVariant(draft: Draft): Draft {
  return {
    ...draft,
    variants: [
      ...draft.variants,
      blankVariant(freshKey(draft, "variant"), draft.colors[0]?.key ?? null),
    ],
  };
}

/** Removes a variant and frees its photos. The last variant cannot be removed (a product always has one). */
export function removeVariant(draft: Draft, variantKey: string): Draft {
  if (draft.variants.length <= 1) return draft;
  return {
    ...draft,
    variants: draft.variants.filter((v) => v.key !== variantKey),
    images: draft.images.map((i) =>
      i.variantKey === variantKey ? { ...i, variantKey: null } : i,
    ),
  };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  )
    return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** "ZOOM-RUNNER-BLK-42": brand prefix, the first words of the product, then color and size. */
export function suggestSku(parts: {
  prefix?: string;
  product: string;
  color?: string;
  size?: string;
}): string {
  const product = slugify(parts.product).split("-").slice(0, 2).join("-");
  return [
    parts.prefix,
    product,
    parts.color && slugify(parts.color).slice(0, 4),
    parts.size && slugify(parts.size),
  ]
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

/** Problems by path ("variants.2.sku"), for showing the message next to the right field. */
export function issueMap(issues: Issue[] | undefined): Map<string, IssueCode> {
  return new Map((issues ?? []).map((i) => [i.path, i.code]));
}
