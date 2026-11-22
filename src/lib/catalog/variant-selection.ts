import { pickImages } from "./pricing";
import type { ColorData, ImageData, SizeData, VariantData } from "./types";

// Pure logic behind the variant picker. Variants are optional: a product may have colors,
// sizes, both, or neither (then it has one default variant with no color and no size).

export type Selection = { colorId: string | null; sizeId: string | null };
export type Axis = "color" | "size";
export type StockState = "in-stock" | "low" | "sold-out";

export const LOW_STOCK_THRESHOLD = 5;

type Options = { colors: ColorData[]; sizes: SizeData[] };

export function stockState(stock: number): StockState {
  if (stock <= 0) return "sold-out";
  return stock <= LOW_STOCK_THRESHOLD ? "low" : "in-stock";
}

/**
 * The size to use for a color: the preferred one when this color has it in stock, otherwise the first size of
 * this color that is in stock, otherwise (all sold out) the preferred or first size. Null when the color has no sizes.
 */
export function defaultSizeId(
  variants: VariantData[],
  colorId: string,
  preferredSizeId: string | null,
): string | null {
  const ofColor = variants.filter(
    (v) => v.colorId === colorId && v.sizeId !== null,
  );
  const inStock = ofColor.filter((v) => v.stock > 0);
  const pool = inStock.length > 0 ? inStock : ofColor;
  const preferred = pool.find((v) => v.sizeId === preferredSizeId);
  return (preferred ?? pool[0])?.sizeId ?? null;
}

/**
 * Sizes to offer: only those the chosen color comes in. Without colors (or before a color is chosen) all sizes.
 */
export function sizesForColor(
  variants: VariantData[],
  { colors, sizes }: Options,
  colorId: string | null,
): SizeData[] {
  if (colors.length === 0 || !colorId) return sizes;
  const ids = new Set(
    variants.filter((v) => v.colorId === colorId).map((v) => v.sizeId),
  );
  return sizes.filter((s) => ids.has(s.id));
}

/**
 * What is selected when the page opens. With colors: the first color that has stock, and a size in stock for it.
 * Without colors: a single size is selected for the shopper.
 */
export function initialSelection(
  variants: VariantData[],
  { colors, sizes }: Options,
): Selection {
  if (colors.length > 0) {
    const first =
      colors.find((c) =>
        variants.some((v) => v.colorId === c.id && v.stock > 0),
      ) ?? colors[0];
    return {
      colorId: first.id,
      sizeId: defaultSizeId(variants, first.id, null),
    };
  }
  return { colorId: null, sizeId: sizes.length === 1 ? sizes[0].id : null };
}

/** Options the shopper still has to choose. Empty means a variant can be resolved. */
export function missingOptions(
  { colors, sizes }: Options,
  sel: Selection,
): Axis[] {
  const missing: Axis[] = [];
  if (colors.length > 0 && !sel.colorId) missing.push("color");
  if (sizes.length > 0 && !sel.sizeId) missing.push("size");
  return missing;
}

/** The exact variant for the selection, or null while options are missing or the combination does not exist. */
export function resolveVariant(
  variants: VariantData[],
  options: Options,
  sel: Selection,
): VariantData | null {
  if (missingOptions(options, sel).length > 0) return null;
  const colorId = options.colors.length > 0 ? sel.colorId : null;
  const sizeId = options.sizes.length > 0 ? sel.sizeId : null;
  return (
    variants.find((v) => v.colorId === colorId && v.sizeId === sizeId) ?? null
  );
}

/**
 * Availability of an option given the other axis' choice. `exists` is false when no variant has the combination;
 * `inStock` is false when every matching variant is sold out; `reachable` says whether the option has stock with
 * any choice on the other axis (a color is offered when it is reachable, because choosing it moves the size).
 */
export function optionAvailability(
  variants: VariantData[],
  axis: Axis,
  optionId: string,
  sel: Selection,
): { exists: boolean; inStock: boolean; reachable: boolean } {
  const ofOption = variants.filter((v) =>
    axis === "color" ? v.colorId === optionId : v.sizeId === optionId,
  );
  const matching = ofOption.filter((v) =>
    axis === "color"
      ? !sel.sizeId || v.sizeId === sel.sizeId
      : !sel.colorId || v.colorId === sel.colorId,
  );
  return {
    exists: matching.length > 0,
    inStock: matching.some((v) => v.stock > 0),
    reachable: ofOption.some((v) => v.stock > 0),
  };
}

/**
 * Chooses an option. Choosing a color moves the size to one that this color comes in and has in stock (the
 * current size when it fits). Choosing a size keeps the color when the pair exists; otherwise the color becomes
 * the only one that has this size, or is cleared.
 */
export function selectOption(
  variants: VariantData[],
  sel: Selection,
  axis: Axis,
  optionId: string,
): Selection {
  if (axis === "color") {
    return {
      colorId: optionId,
      sizeId: defaultSizeId(variants, optionId, sel.sizeId) ?? sel.sizeId,
    };
  }
  const next: Selection = { ...sel, sizeId: optionId };
  const compatible = variants.some(
    (v) =>
      (!next.colorId || v.colorId === next.colorId) && v.sizeId === optionId,
  );
  if (compatible) return next;
  const colors = [
    ...new Set(
      variants
        .filter((v) => v.sizeId === optionId)
        .map((v) => v.colorId)
        .filter((id): id is string => id !== null),
    ),
  ];
  return { ...next, colorId: colors.length === 1 ? colors[0] : null };
}

/** Price to show: the chosen variant's, else the lowest with a "from" flag when prices differ. */
export function displayPrice(
  variants: VariantData[],
  selected: VariantData | null,
  basePrice: number,
) {
  if (selected) return { price: selected.price, from: false };
  const prices = variants.map((v) => v.price);
  if (prices.length === 0) return { price: basePrice, from: false };
  const min = Math.min(...prices);
  return { price: min, from: new Set(prices).size > 1 };
}

/**
 * Photos for the gallery: the variant's own, else its color's, else general photos.
 * With only a color chosen, that color's photos. Never empty while the product has any photo.
 */
export function galleryImages(
  images: ImageData[],
  sel: Selection,
  variant: VariantData | null,
): ImageData[] {
  const general = images
    .filter((i) => !i.variantId && !i.colorId)
    .sort((a, b) => a.position - b.position);
  let chosen: ImageData[];
  if (variant) {
    chosen = pickImages(images, variant);
  } else if (sel.colorId) {
    chosen = images
      .filter((i) => i.colorId === sel.colorId)
      .sort((a, b) => a.position - b.position);
  } else {
    chosen = general;
  }
  if (chosen.length > 0) return chosen;
  return general.length > 0
    ? general
    : [...images].sort((a, b) => a.position - b.position);
}
