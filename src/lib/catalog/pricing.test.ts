import { describe, expect, it } from "vitest";
import { effectivePrice, pickImages, salePercent } from "./pricing";

describe("salePercent", () => {
  it("rounds the discount", () => {
    expect(salePercent(1_790_000, 2_090_000)).toBe(14);
    expect(salePercent(500, 1000)).toBe(50);
  });
  it("is null without a real discount", () => {
    expect(salePercent(1000, null)).toBeNull();
    expect(salePercent(1000, 1000)).toBeNull();
    expect(salePercent(1000, 500)).toBeNull();
    expect(salePercent(9_999, 10_000)).toBeNull(); // rounds to 0%
  });
});

describe("effectivePrice", () => {
  it("uses the variant price when set", () => {
    expect(effectivePrice({ price: 100 }, { price: 150 })).toBe(150);
  });
  it("falls back to the product price", () => {
    expect(effectivePrice({ price: 100 }, { price: null })).toBe(100);
  });
});

describe("pickImages", () => {
  const images = [
    { id: "g1", variantId: null, colorId: null, position: 0 },
    { id: "c2", variantId: null, colorId: "black", position: 1 },
    { id: "c1", variantId: null, colorId: "black", position: 0 },
    { id: "v1", variantId: "blk-42", colorId: null, position: 0 },
  ];

  it("prefers the variant's own photos", () => {
    expect(pickImages(images, { id: "blk-42", colorId: "black" }).map((i) => i.id)).toEqual(["v1"]);
  });

  it("falls back to the color's photos, sorted by position", () => {
    expect(pickImages(images, { id: "blk-41", colorId: "black" }).map((i) => i.id)).toEqual(["c1", "c2"]);
  });

  it("falls back to general photos", () => {
    expect(pickImages(images, { id: "wht-41", colorId: "white" }).map((i) => i.id)).toEqual(["g1"]);
    expect(pickImages(images, { id: "digi", colorId: null }).map((i) => i.id)).toEqual(["g1"]);
  });
});
