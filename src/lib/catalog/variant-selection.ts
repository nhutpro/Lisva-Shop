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

/** Axes with a single choice are selected for the shopper. */
export function initialSelection(variants: VariantData[], { colors, sizes }: Options): Selection {
  return {
    colorId: colors.length === 1 ? colors[0].id : null,
    sizeId: sizes.length === 1 ? sizes[0].id : null,
  };
}

/** Options the shopper still has to choose. Empty means a variant can be resolved. */
export function missingOptions({ colors, sizes }: Options, sel: Selection): Axis[] {
  const missing: Axis[] = [];
  if (colors.length > 0 && !sel.colorId) missing.push("color");
  if (sizes.length > 0 && !sel.sizeId) missing.push("size");
  return missing;
}

/** The exact variant for the selection, or null while options are missing or the combination does not exist. */
export function resolveVariant(variants: VariantData[], options: Options, sel: Selection): VariantData | null {
  if (missingOptions(options, sel).length > 0) return null;
  const colorId = options.colors.length > 0 ? sel.colorId : null;
  const sizeId = options.sizes.length > 0 ? sel.sizeId : null;
  return variants.find((v) => v.colorId === colorId && v.sizeId === sizeId) ?? null;
}

/**
 * Can this option be chosen given the other axis? `exists` is false when no variant has the
 * combination; `inStock` is false when every matching variant is sold out.
 */
export function optionAvailability(
  variants: VariantData[],
  axis: Axis,
  optionId: string,
  sel: Selection,
): { exists: boolean; inStock: boolean } {
  const matching = variants.filter((v) => {
    if (axis === "color") return v.colorId === optionId && (!sel.sizeId || v.sizeId === sel.sizeId);
    return v.sizeId === optionId && (!sel.colorId || v.colorId === sel.colorId);
  });
  return { exists: matching.length > 0, inStock: matching.some((v) => v.stock > 0) };
}

/** Chooses an option. If the other axis' choice no longer exists with it, that choice is cleared. */
export function selectOption(variants: VariantData[], sel: Selection, axis: Axis, optionId: string): Selection {
  const next: Selection = axis === "color" ? { ...sel, colorId: optionId } : { ...sel, sizeId: optionId };
  const compatible = variants.some(
    (v) => (!next.colorId || v.colorId === next.colorId) && (!next.sizeId || v.sizeId === next.sizeId),
  );
  if (compatible) return next;
  return axis === "color" ? { ...next, sizeId: null } : { ...next, colorId: null };
}

/** Price to show: the chosen variant's, else the lowest with a "from" flag when prices differ. */
export function displayPrice(variants: VariantData[], selected: VariantData | null, basePrice: number) {
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
export function galleryImages(images: ImageData[], sel: Selection, variant: VariantData | null): ImageData[] {
  const general = images.filter((i) => !i.variantId && !i.colorId).sort((a, b) => a.position - b.position);
  let chosen: ImageData[];
  if (variant) {
    chosen = pickImages(images, variant);
  } else if (sel.colorId) {
    chosen = images.filter((i) => i.colorId === sel.colorId).sort((a, b) => a.position - b.position);
  } else {
    chosen = general;
  }
  if (chosen.length > 0) return chosen;
  return general.length > 0 ? general : [...images].sort((a, b) => a.position - b.position);
}
