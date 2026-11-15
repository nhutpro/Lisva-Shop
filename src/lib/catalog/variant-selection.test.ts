import { describe, expect, it } from "vitest";
import {
  displayPrice,
  galleryImages,
  initialSelection,
  missingOptions,
  optionAvailability,
  resolveVariant,
  selectOption,
  stockState,
} from "./variant-selection";
import type { ColorData, ImageData, SizeData, VariantData } from "./types";

const black: ColorData = { id: "c-blk", nameVi: "Đen", nameEn: "Black", hex: "#111" };
const white: ColorData = { id: "c-wht", nameVi: "Trắng", nameEn: "White", hex: "#fff" };
const s41: SizeData = { id: "s41", label: "41", type: "SHOE", footLengthCm: 25.5, usSize: "8" };
const s42: SizeData = { id: "s42", label: "42", type: "SHOE", footLengthCm: 26.5, usSize: "9" };

// Black has 41 and 42, White only 42 (sold out).
const variants: VariantData[] = [
  { id: "v1", sku: "BLK-41", colorId: "c-blk", sizeId: "s41", price: 2_000_000, stock: 3 },
  { id: "v2", sku: "BLK-42", colorId: "c-blk", sizeId: "s42", price: 2_200_000, stock: 0 },
  { id: "v3", sku: "WHT-42", colorId: "c-wht", sizeId: "s42", price: 2_000_000, stock: 0 },
];
const both = { colors: [black, white], sizes: [s41, s42] };
const none = { colors: [], sizes: [] };
const empty = { colorId: null, sizeId: null };

describe("stockState", () => {
  it.each([[0, "sold-out"], [-1, "sold-out"], [1, "low"], [5, "low"], [6, "in-stock"]])("%i is %s", (n, s) => {
    expect(stockState(n)).toBe(s);
  });
});

describe("missingOptions and resolveVariant", () => {
  it("asks for both axes when the product has colors and sizes", () => {
    expect(missingOptions(both, empty)).toEqual(["color", "size"]);
    expect(missingOptions(both, { colorId: "c-blk", sizeId: null })).toEqual(["size"]);
    expect(resolveVariant(variants, both, { colorId: "c-blk", sizeId: null })).toBeNull();
  });

  it("resolves the exact variant once everything is chosen", () => {
    expect(resolveVariant(variants, both, { colorId: "c-blk", sizeId: "s42" })?.sku).toBe("BLK-42");
  });

  it("returns null for a combination that does not exist", () => {
    expect(resolveVariant(variants, both, { colorId: "c-wht", sizeId: "s41" })).toBeNull();
  });

  it("works with only colors, only sizes, or neither", () => {
    const colorOnly: VariantData[] = [{ id: "a", sku: "A", colorId: "c-blk", sizeId: null, price: 1, stock: 1 }];
    expect(resolveVariant(colorOnly, { colors: [black], sizes: [] }, { colorId: "c-blk", sizeId: null })?.sku).toBe("A");

    const sizeOnly: VariantData[] = [{ id: "b", sku: "B", colorId: null, sizeId: "s41", price: 1, stock: 1 }];
    expect(resolveVariant(sizeOnly, { colors: [], sizes: [s41] }, { colorId: null, sizeId: "s41" })?.sku).toBe("B");

    const plain: VariantData[] = [{ id: "d", sku: "D", colorId: null, sizeId: null, price: 590_000, stock: 12 }];
    expect(missingOptions(none, empty)).toEqual([]);
    expect(resolveVariant(plain, none, empty)?.sku).toBe("D");
  });
});

describe("initialSelection", () => {
  it("selects an axis that has a single choice", () => {
    expect(initialSelection(variants, { colors: [black], sizes: [s41, s42] })).toEqual({ colorId: "c-blk", sizeId: null });
    expect(initialSelection(variants, both)).toEqual(empty);
    expect(initialSelection([], none)).toEqual(empty);
  });
});

describe("optionAvailability", () => {
  it("marks combinations that do not exist or are sold out", () => {
    // Nothing else chosen: White exists (size 42) but is sold out, Black has stock.
    expect(optionAvailability(variants, "color", "c-wht", empty)).toEqual({ exists: true, inStock: false });
    expect(optionAvailability(variants, "color", "c-blk", empty)).toEqual({ exists: true, inStock: true });
    // With size 41 chosen, White does not exist at all.
    expect(optionAvailability(variants, "color", "c-wht", { colorId: null, sizeId: "s41" })).toEqual({ exists: false, inStock: false });
    // With Black chosen, 42 exists but is sold out; 41 is available.
    expect(optionAvailability(variants, "size", "s42", { colorId: "c-blk", sizeId: null })).toEqual({ exists: true, inStock: false });
    expect(optionAvailability(variants, "size", "s41", { colorId: "c-blk", sizeId: null })).toEqual({ exists: true, inStock: true });
  });
});

describe("selectOption", () => {
  it("keeps a compatible choice on the other axis", () => {
    expect(selectOption(variants, { colorId: null, sizeId: "s42" }, "color", "c-blk")).toEqual({ colorId: "c-blk", sizeId: "s42" });
  });

  it("clears the other axis when the combination does not exist", () => {
    expect(selectOption(variants, { colorId: null, sizeId: "s41" }, "color", "c-wht")).toEqual({ colorId: "c-wht", sizeId: null });
    expect(selectOption(variants, { colorId: "c-wht", sizeId: null }, "size", "s41")).toEqual({ colorId: null, sizeId: "s41" });
  });
});

describe("displayPrice", () => {
  it("shows the selected variant's price", () => {
    expect(displayPrice(variants, variants[1], 2_000_000)).toEqual({ price: 2_200_000, from: false });
  });
  it("shows the lowest price with a 'from' flag when prices differ", () => {
    expect(displayPrice(variants, null, 2_000_000)).toEqual({ price: 2_000_000, from: true });
  });
  it("has no 'from' flag when every variant costs the same", () => {
    expect(displayPrice([variants[0], variants[2]], null, 2_000_000)).toEqual({ price: 2_000_000, from: false });
  });
  it("falls back to the base price with no variants", () => {
    expect(displayPrice([], null, 123)).toEqual({ price: 123, from: false });
  });
});

describe("galleryImages", () => {
  const img = (id: string, extra: Partial<ImageData> = {}): ImageData => ({
    id, url: `/${id}.jpg`, altVi: null, altEn: null, variantId: null, colorId: null, position: 0, ...extra,
  });
  const images = [
    img("general"),
    img("black-2", { colorId: "c-blk", position: 1 }),
    img("black-1", { colorId: "c-blk", position: 0 }),
    img("v1-own", { variantId: "v1" }),
  ];

  it("shows general photos before anything is chosen", () => {
    expect(galleryImages(images, empty, null).map((i) => i.id)).toEqual(["general"]);
  });
  it("shows the color's photos when only a color is chosen", () => {
    expect(galleryImages(images, { colorId: "c-blk", sizeId: null }, null).map((i) => i.id)).toEqual(["black-1", "black-2"]);
  });
  it("prefers the variant's own photos, then its color's", () => {
    expect(galleryImages(images, { colorId: "c-blk", sizeId: "s41" }, variants[0]).map((i) => i.id)).toEqual(["v1-own"]);
    expect(galleryImages(images, { colorId: "c-blk", sizeId: "s42" }, variants[1]).map((i) => i.id)).toEqual(["black-1", "black-2"]);
  });
  it("falls back to general photos, and to any photo when there are no general ones", () => {
    expect(galleryImages(images, { colorId: "c-wht", sizeId: "s42" }, variants[2]).map((i) => i.id)).toEqual(["general"]);
    expect(galleryImages([img("only", { colorId: "c-blk" })], empty, null).map((i) => i.id)).toEqual(["only"]);
    expect(galleryImages([], empty, null)).toEqual([]);
  });
});
