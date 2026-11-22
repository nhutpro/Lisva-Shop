import { describe, expect, it } from "vitest";
import { issueLocation } from "./issue-location";

describe("issueLocation", () => {
  it("finds top-level fields", () => {
    expect(issueLocation("nameEn")).toEqual({
      elementId: "nameEn",
      section: "basic",
      field: "nameEn",
    });
    expect(issueLocation("price")).toEqual({
      elementId: "price",
      section: "pricing",
      field: "price",
    });
  });

  it("finds fields inside lists, using the editor's input ids", () => {
    expect(issueLocation("variants.2.sku")).toEqual({
      elementId: "variant-2-sku",
      section: "variants",
      field: "sku",
      index: 2,
    });
    expect(issueLocation("variants.0.colorKey")?.elementId).toBe(
      "variant-0-color",
    );
    expect(issueLocation("variants.1.sizeId")?.elementId).toBe(
      "variant-1-size",
    );
    expect(issueLocation("colors.0.nameEn")?.elementId).toBe("color-0-nameEn");
    expect(issueLocation("specs.3.valueVi")?.elementId).toBe("spec-3-valueVi");
    expect(issueLocation("images.1.url")?.elementId).toBe("image-1-url");
    expect(issueLocation("images.1.variantKey")?.elementId).toBe(
      "image-1-target",
    );
  });

  it("points to the whole section when the problem belongs to the list itself or an unknown field", () => {
    expect(issueLocation("variants")?.elementId).toBe("variants");
    expect(issueLocation("variants.0")?.elementId).toBe("variants");
    expect(issueLocation("images.0.nope")?.elementId).toBe("images");
    expect(issueLocation("specs")?.elementId).toBe("specs");
  });

  it("returns null for paths it does not know", () => {
    expect(issueLocation("")).toBeNull();
    expect(issueLocation("whatever.0.x")).toBeNull();
  });
});
