import { describe, expect, it } from "vitest";
import { productFormSchema } from "./product-schema";
import {
  addColor,
  addVariant,
  emptyDraft,
  freshKey,
  issueMap,
  moveItem,
  removeColor,
  removeVariant,
  suggestSku,
  toDraft,
  type Draft,
} from "./editor-state";

// Whatever the helpers produce must still be accepted by the server's schema (apart from fields the user still has to fill in).
const valid = (d: Draft) =>
  productFormSchema.safeParse({
    ...d,
    slug: "x",
    categoryId: "c",
    brandId: "b",
    nameVi: "Tên",
    descriptionVi: "Mô tả",
    nameEn: "Name",
    descriptionEn: "Description",
    price: "1",
    variants: d.variants.map((v, i) => ({ ...v, sku: `S-${i}` })),
    colors: d.colors.map((c, i) => ({
      ...c,
      nameVi: `Màu ${i}`,
      nameEn: `Color ${i}`,
    })),
  }).success;

const base = (): Draft => ({
  ...emptyDraft({ categoryId: "cat", brandId: "brand" }),
  slug: "giay",
  nameVi: "Giày",
  price: "100",
  colors: [
    { key: "c1", nameVi: "Đen", nameEn: "", hex: "" },
    { key: "c2", nameVi: "Trắng", nameEn: "", hex: "" },
  ],
  variants: [
    {
      key: "v1",
      colorKey: "c1",
      sizeId: "s41",
      sku: "A-1",
      price: "",
      stock: "3",
      isActive: true,
    },
    {
      key: "v2",
      colorKey: "c1",
      sizeId: "s42",
      sku: "A-2",
      price: "",
      stock: "2",
      isActive: true,
    },
    {
      key: "v3",
      colorKey: "c2",
      sizeId: "s42",
      sku: "A-3",
      price: "",
      stock: "1",
      isActive: true,
    },
  ],
  images: [
    { url: "/g.jpg", altVi: "", altEn: "", colorKey: null, variantKey: null },
    { url: "/c1.jpg", altVi: "", altEn: "", colorKey: "c1", variantKey: null },
    { url: "/v3.jpg", altVi: "", altEn: "", colorKey: null, variantKey: "v3" },
  ],
});

describe("toDraft and emptyDraft", () => {
  it("keeps numbers as text so they can be edited", () => {
    const draft = toDraft({
      slug: "a",
      categoryId: "c",
      brandId: "b",
      nameVi: "A",
      nameEn: "",
      descriptionVi: "",
      descriptionEn: "",
      price: 1_000,
      compareAtPrice: null,
      status: "ACTIVE",
      featured: false,
      specs: [],
      colors: [],
      images: [],
      variants: [
        {
          key: "v",
          colorKey: null,
          sizeId: null,
          sku: "A",
          price: null,
          stock: 5,
          isActive: true,
        },
      ],
    });
    expect([
      draft.price,
      draft.compareAtPrice,
      draft.variants[0].price,
      draft.variants[0].stock,
    ]).toEqual(["1000", "", "", "5"]);
  });

  it("starts a new product as a draft with one default variant", () => {
    const draft = emptyDraft({ brandId: "b" });
    expect(draft).toMatchObject({
      status: "DRAFT",
      brandId: "b",
      colors: [],
      images: [],
    });
    expect(draft.variants).toHaveLength(1);
    expect(draft.variants[0]).toMatchObject({
      colorKey: null,
      sizeId: null,
      stock: "0",
      isActive: true,
    });
  });
});

describe("colors", () => {
  it("the first color is given to the existing variants, so the product stays consistent", () => {
    const plain = {
      ...base(),
      colors: [],
      variants: [
        {
          key: "v1",
          colorKey: null,
          sizeId: null,
          sku: "A-1",
          price: "",
          stock: "1",
          isActive: true,
        },
      ],
      images: [],
    };
    const next = addColor(plain);
    expect(next.colors).toHaveLength(1);
    expect(next.variants[0].colorKey).toBe(next.colors[0].key);
    expect(valid(next)).toBe(true);
  });

  it("further colors add nothing to the variants", () => {
    const next = addColor(base());
    expect(next.colors).toHaveLength(3);
    expect(next.variants).toEqual(base().variants);
    expect(new Set(next.colors.map((c) => c.key)).size).toBe(3);
  });

  it("removing a color removes its variants and frees the photos tied to them", () => {
    const next = removeColor(base(), "c2");
    expect(next.colors.map((c) => c.key)).toEqual(["c1"]);
    expect(next.variants.map((v) => v.key)).toEqual(["v1", "v2"]);
    expect(next.images.map((i) => [i.colorKey, i.variantKey])).toEqual([
      [null, null],
      ["c1", null],
      [null, null],
    ]); // the photo of v3 is now general
    expect(valid(next)).toBe(true);
  });

  it("frees photos tied to the removed color itself", () => {
    const next = removeColor(base(), "c1");
    expect(next.images[1]).toMatchObject({ colorKey: null, variantKey: null });
  });

  it("removing every color leaves one plain default variant", () => {
    const next = removeColor(removeColor(base(), "c1"), "c2");
    expect(next.colors).toEqual([]);
    expect(next.variants).toHaveLength(1);
    expect(next.variants[0].colorKey).toBeNull();
    expect(valid(next)).toBe(true);
  });
});

describe("variants", () => {
  it("a new variant gets the first color when the product has colors", () => {
    const next = addVariant(base());
    expect(next.variants).toHaveLength(4);
    expect(next.variants[3]).toMatchObject({
      colorKey: "c1",
      sku: "",
      stock: "0",
      isActive: true,
    });
    expect(
      addVariant({ ...base(), colors: [] }).variants[3].colorKey,
    ).toBeNull();
  });

  it("removing a variant frees its photos", () => {
    const next = removeVariant(base(), "v3");
    expect(next.variants.map((v) => v.key)).toEqual(["v1", "v2"]);
    expect(next.images[2].variantKey).toBeNull();
    expect(valid(next)).toBe(true);
  });

  it("never removes the last variant", () => {
    const one = emptyDraft();
    expect(removeVariant(one, one.variants[0].key)).toBe(one);
  });

  it("freshKey never repeats an existing key", () => {
    let draft = base();
    const keys = new Set(draft.variants.map((v) => v.key));
    for (let i = 0; i < 5; i++) {
      draft = addVariant(draft);
      keys.add(draft.variants.at(-1)!.key);
    }
    expect(keys.size).toBe(8);
    expect(freshKey(draft, "color")).toBe("new-color-1");
  });
});

describe("moveItem", () => {
  it("moves an element and leaves bad requests alone", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    const list = ["a", "b"];
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(moveItem(list, -1, 0)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });
});

describe("suggestSku", () => {
  it("combines brand, product, color and size in capitals", () => {
    expect(
      suggestSku({
        prefix: "zoom",
        product: "Giày chạy bộ Runner 2",
        color: "Đen",
        size: "42",
      }),
    ).toBe("ZOOM-GIAY-CHAY-DEN-42");
    expect(
      suggestSku({ prefix: "TIDE", product: "Classic Watch", size: "40mm" }),
    ).toBe("TIDE-CLASSIC-WATCH-40MM");
  });

  it("produces a SKU the server accepts, even from odd input", () => {
    const sku = suggestSku({
      prefix: "a",
      product: "!!! ???",
      color: "***",
      size: "1/2",
    });
    expect(sku).toMatch(/^[A-Z0-9][A-Z0-9._-]{1,63}$/);
    expect(suggestSku({ product: "x".repeat(200) }).length).toBeLessThanOrEqual(
      64,
    );
  });
});

describe("issueMap", () => {
  it("indexes problems by path", () => {
    const map = issueMap([
      { path: "variants.1.sku", code: "sku_taken" },
      { path: "slug", code: "slug_taken" },
    ]);
    expect(map.get("variants.1.sku")).toBe("sku_taken");
    expect(map.get("nothing")).toBeUndefined();
    expect(issueMap(undefined).size).toBe(0);
  });
});
