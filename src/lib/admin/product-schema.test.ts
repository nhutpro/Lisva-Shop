import { describe, expect, it } from "vitest";
import { issuesFromZod } from "./zod-issues";
import { productFormSchema, type ProductFormInput } from "./product-schema";

const base = (): ProductFormInput => ({
  slug: "giay-chay-bo-runner",
  categoryId: "cat-1",
  brandId: "brand-1",
  nameVi: "Giày chạy bộ Runner",
  nameEn: "Running shoes",
  descriptionVi: "Giày chạy bộ nhẹ, êm.",
  descriptionEn: "Light, soft running shoes.",
  price: 2_000_000,
  status: "ACTIVE",
  variants: [{ key: "v1", sku: "run-1", stock: 5 }],
});

const issues = (input: unknown) => {
  const result = productFormSchema.safeParse(input);
  return result.success ? [] : issuesFromZod(result.error, input);
};
const codeAt = (input: unknown, path: string) =>
  issues(input).find((i) => i.path === path)?.code;

describe("a valid product", () => {
  it("accepts the smallest product: a name, a price and one default variant", () => {
    const parsed = productFormSchema.parse(base());
    expect(parsed.variants[0]).toMatchObject({
      sku: "RUN-1",
      stock: 5,
      isActive: true,
    }); // SKUs are stored in capitals
    expect(parsed.colors).toEqual([]);
    expect(parsed.featured).toBe(false);
  });

  it("accepts numbers typed as text, and empty optional fields", () => {
    const parsed = productFormSchema.parse({
      ...base(),
      price: "2000000",
      compareAtPrice: "",
      variants: [
        {
          key: "v1",
          sku: "A1",
          stock: "3",
          price: "",
          colorKey: "",
          sizeId: null,
        },
      ],
    });
    expect(parsed).toMatchObject({
      price: 2_000_000,
      compareAtPrice: undefined,
      nameEn: "Running shoes",
    });
    expect(parsed.variants[0]).toMatchObject({
      stock: 3,
      price: undefined,
      colorKey: undefined,
      sizeId: undefined,
    });
  });

  it("accepts a product with colors, sizes and photos tied to a color or a variant", () => {
    const input = {
      ...base(),
      colors: [
        { key: "c1", nameVi: "Đen", nameEn: "Black", hex: "#111111" },
        { key: "c2", nameVi: "Trắng", nameEn: "White" },
      ],
      variants: [
        { key: "v1", colorKey: "c1", sizeId: "s41", sku: "A-BLK-41", stock: 1 },
        { key: "v2", colorKey: "c1", sizeId: "s42", sku: "A-BLK-42", stock: 1 },
        { key: "v3", colorKey: "c2", sizeId: "s42", sku: "A-WHT-42", stock: 1 },
      ],
      images: [
        { url: "https://cdn.example.com/a.jpg" },
        { url: "/placeholders/shoe.svg", colorKey: "c1" },
        { url: "/x.jpg", variantKey: "v3" },
      ],
    };
    expect(issues(input)).toEqual([]);
  });
});

describe("required fields and formats", () => {
  it.each([
    ["slug", { slug: "Giày Chạy" }, "slug", "invalid_slug"],
    ["slug empty", { slug: "" }, "slug", "required"],
    ["name too short", { nameVi: "A" }, "nameVi", "too_short"],
    ["name missing", { nameVi: "" }, "nameVi", "required"],
    ["category", { categoryId: "" }, "categoryId", "required"],
    ["negative price", { price: -1 }, "price", "negative"],
    ["missing price", { price: "" }, "price", "required"],
    ["bad status", { status: "LIVE" }, "status", "invalid"],
    ["English name missing", { nameEn: " " }, "nameEn", "required"],
    [
      "English description missing",
      { descriptionEn: "" },
      "descriptionEn",
      "required",
    ],
    [
      "Vietnamese description missing",
      { descriptionVi: "  " },
      "descriptionVi",
      "required",
    ],
    [
      "description too long",
      { descriptionVi: "x".repeat(5001) },
      "descriptionVi",
      "too_long",
    ],
  ])("%s", (_name, change, path, code) => {
    expect(codeAt({ ...base(), ...change }, path)).toBe(code);
  });

  it("needs at least one variant", () => {
    expect(codeAt({ ...base(), variants: [] }, "variants")).toBe("too_short");
  });

  it("checks the original price is not below the price", () => {
    expect(
      codeAt({ ...base(), compareAtPrice: 1_000_000 }, "compareAtPrice"),
    ).toBe("compare_below_price");
    expect(issues({ ...base(), compareAtPrice: 2_000_000 })).toEqual([]);
  });
});

describe("variants", () => {
  const v = (extra: Record<string, unknown>) => ({
    ...base(),
    variants: [{ key: "v1", sku: "OK-1", stock: 1, ...extra }],
  });

  it.each([
    ["short sku", { sku: "x" }, "variants.0.sku", "invalid_sku"],
    ["sku with spaces", { sku: "A B" }, "variants.0.sku", "invalid_sku"],
    ["negative stock", { stock: -1 }, "variants.0.stock", "negative"],
    ["stock not a number", { stock: "lots" }, "variants.0.stock", "invalid"],
    ["negative price", { price: -5 }, "variants.0.price", "negative"],
  ])("%s", (_n, change, path, code) => {
    expect(codeAt(v(change), path)).toBe(code);
  });

  it("refuses two variants with the same SKU, ignoring letter case", () => {
    // Different sizes, so only the SKU is a problem.
    const input = {
      ...base(),
      variants: [
        { key: "a", sku: "SAME-1", sizeId: "s1", stock: 1 },
        { key: "b", sku: "same-1", sizeId: "s2", stock: 1 },
      ],
    };
    expect(issues(input)).toEqual([
      { path: "variants.1.sku", code: "duplicate_sku" },
    ]);
  });

  it("refuses two variants with the same color and size, also when both have none", () => {
    const plain = {
      ...base(),
      variants: [
        { key: "a", sku: "A-1", stock: 1 },
        { key: "b", sku: "A-2", stock: 1 },
      ],
    };
    expect(issues(plain)).toEqual([
      { path: "variants.1.sizeId", code: "duplicate_variant" },
    ]);

    const colored = {
      ...base(),
      colors: [{ key: "c1", nameVi: "Đen", nameEn: "Black" }],
      variants: [
        { key: "a", colorKey: "c1", sizeId: "s1", sku: "A-1", stock: 1 },
        { key: "b", colorKey: "c1", sizeId: "s1", sku: "A-2", stock: 1 },
      ],
    };
    expect(issues(colored)).toEqual([
      { path: "variants.1.sizeId", code: "duplicate_variant" },
    ]);
  });

  it("needs a color on every variant once the product has colors (otherwise the shop could never find it)", () => {
    const input = {
      ...base(),
      colors: [{ key: "c1", nameVi: "Đen", nameEn: "Black" }],
      variants: [
        { key: "a", colorKey: "c1", sku: "A-1", stock: 1 },
        { key: "b", sku: "A-2", sizeId: "s1", stock: 1 },
      ],
    };
    expect(codeAt(input, "variants.1.colorKey")).toBe("mixed_color_options");
  });

  it("refuses a color that is not defined, and a color on a product without colors", () => {
    expect(
      codeAt(
        {
          ...base(),
          colors: [{ key: "c1", nameVi: "Đen", nameEn: "Black" }],
          variants: [{ key: "a", colorKey: "zzz", sku: "A-1", stock: 1 }],
        },
        "variants.0.colorKey",
      ),
    ).toBe("unknown_color");
    expect(codeAt(v({ colorKey: "c1" }), "variants.0.colorKey")).toBe(
      "unknown_color",
    );
  });

  it("needs a size on every variant once any variant has one", () => {
    const input = {
      ...base(),
      variants: [
        { key: "a", sizeId: "s1", sku: "A-1", stock: 1 },
        { key: "b", sku: "A-2", stock: 1 },
      ],
    };
    expect(codeAt(input, "variants.1.sizeId")).toBe("mixed_size_options");
  });
});

describe("colors", () => {
  it("refuses duplicate color names, ignoring letter case, and bad swatches", () => {
    const input = {
      ...base(),
      colors: [
        { key: "a", nameVi: "Đen", nameEn: "Black" },
        { key: "b", nameVi: "đen", nameEn: "black" },
        { key: "c", nameVi: "Xanh", nameEn: "Blue", hex: "blue" },
      ],
    };
    expect(issues(input)).toEqual(
      expect.arrayContaining([
        { path: "colors.1.nameVi", code: "duplicate_color" },
        { path: "colors.2.hex", code: "invalid_color" },
      ]),
    );
  });
});

describe("photos", () => {
  const withImages = (images: unknown[]) => ({
    ...base(),
    colors: [{ key: "c1", nameVi: "Đen", nameEn: "Black" }],
    variants: [{ key: "v1", colorKey: "c1", sku: "A-1", stock: 1 }],
    images,
  });

  it.each([
    "https://example.com/a.jpg",
    "/placeholders/shoe.svg",
    "/a.jpg?x=1",
  ])("accepts %s", (url) => expect(issues(withImages([{ url }]))).toEqual([]));

  it.each([
    "http://example.com/a.jpg",
    "//evil.com/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "ftp://x/y",
    "a.jpg",
    "https://",
    "/a b.jpg",
    "",
  ])("refuses %j", (url) =>
    expect(issues(withImages([{ url }])).length).toBeGreaterThan(0),
  );

  it("allows only one target per photo, and the target must exist", () => {
    expect(
      codeAt(
        withImages([{ url: "/a.jpg", colorKey: "c1", variantKey: "v1" }]),
        "images.0.colorKey",
      ),
    ).toBe("image_target");
    expect(
      codeAt(
        withImages([{ url: "/a.jpg", colorKey: "nope" }]),
        "images.0.colorKey",
      ),
    ).toBe("unknown_color");
    expect(
      codeAt(
        withImages([{ url: "/a.jpg", variantKey: "nope" }]),
        "images.0.variantKey",
      ),
    ).toBe("unknown_variant");
    expect(
      issues(
        withImages([
          { url: "/a.jpg", colorKey: "c1" },
          { url: "/b.jpg", variantKey: "v1" },
        ]),
      ),
    ).toEqual([]);
  });
});
