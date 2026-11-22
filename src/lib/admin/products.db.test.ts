// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  basics,
  buildShop,
  resetDb,
  testDb,
  validCustomer,
} from "../../test/db";
import { getProductDetail, listProducts } from "../catalog/queries-core";
import { parseListParams } from "../catalog/parse-list-params";
import { createOrder } from "../orders/create-order";
import type { ProductFormInput } from "./product-schema";
import {
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  saveProduct,
} from "./products";

let b: Awaited<ReturnType<typeof basics>>;

const payload = (extra: Partial<ProductFormInput> = {}): ProductFormInput => ({
  slug: "giay-runner",
  categoryId: b.shoes.id,
  brandId: b.brand.id,
  nameVi: "Giày Runner",
  nameEn: "Runner shoes",
  descriptionVi: "Mô tả giày",
  descriptionEn: "Shoe description",
  price: 2_000_000,
  status: "ACTIVE",
  variants: [{ key: "new-1", sku: "run-default", stock: 7 }],
  ...extra,
});

const withOptions = (): ProductFormInput =>
  payload({
    colors: [
      { key: "c-blk", nameVi: "Đen", nameEn: "Black", hex: "#111111" },
      { key: "c-wht", nameVi: "Trắng", nameEn: "White" },
    ],
    variants: [
      {
        key: "v-1",
        colorKey: "c-blk",
        sizeId: b.s41.id,
        sku: "run-blk-41",
        stock: 3,
      },
      {
        key: "v-2",
        colorKey: "c-blk",
        sizeId: b.s42.id,
        sku: "run-blk-42",
        stock: 2,
        price: 2_200_000,
      },
      {
        key: "v-3",
        colorKey: "c-wht",
        sizeId: b.s42.id,
        sku: "run-wht-42",
        stock: 0,
        isActive: false,
      },
    ],
    images: [
      { url: "/general.jpg" },
      { url: "https://cdn.example.com/black.jpg", colorKey: "c-blk" },
      { url: "/v2.jpg", variantKey: "v-2" },
    ],
    specs: [
      {
        labelVi: "Chất liệu thân",
        labelEn: "Upper",
        valueVi: "Lưới",
        valueEn: "Mesh",
      },
      { labelVi: "Đế", labelEn: "Sole", valueVi: "Cao su", valueEn: "Rubber" },
    ],
  });

const saved = async (input: ProductFormInput) => {
  const r = await saveProduct(testDb, input);
  if (!r.ok) throw new Error(`save failed: ${JSON.stringify(r.error)}`);
  return r.value;
};
const editor = async (id: string) => {
  const e = await getAdminProduct(testDb, id);
  if (!e) throw new Error("not found");
  return e;
};

beforeEach(async () => {
  await resetDb();
  b = await basics();
});

describe("creating a product", () => {
  it("makes a product without options with exactly one default variant", async () => {
    const { id } = await saved(payload());
    const variants = await testDb.productVariant.findMany({
      where: { productId: id },
    });
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({
      sku: "RUN-DEFAULT",
      stock: 7,
      colorId: null,
      sizeId: null,
      isActive: true,
    });
  });

  it("builds the search text without diacritics, from the name, brand and category", async () => {
    const { id } = await saved(
      payload({ nameVi: "Giày Đẹp", nameEn: "Pretty shoe" }),
    );
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id } })).searchText,
    ).toBe("giay dep pretty shoe zoomer giay");
  });

  it("sets the publish date for an active product only", async () => {
    const live = await saved(payload());
    const draft = await saved(
      payload({
        slug: "ban-nhap",
        status: "DRAFT",
        variants: [{ key: "n", sku: "draft-1", stock: 0 }],
      }),
    );
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id: live.id } }))
        .publishedAt,
    ).toBeInstanceOf(Date);
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id: draft.id } }))
        .publishedAt,
    ).toBeNull();
  });

  it("stores colors, sizes, own prices, switched-off variants and links photos to colors or variants", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);

    expect(e.colors.map((c) => [c.nameVi, c.nameEn, c.hex])).toEqual([
      ["Đen", "Black", "#111111"],
      ["Trắng", "White", ""],
    ]);
    expect(
      e.variants.map((v) => [v.sku, v.stock, v.price, v.isActive]),
    ).toEqual([
      ["RUN-BLK-41", 3, null, true],
      ["RUN-BLK-42", 2, 2_200_000, true],
      ["RUN-WHT-42", 0, null, false],
    ]);
    const [general, colorPhoto, variantPhoto] = e.images;
    expect([general.colorKey, general.variantKey]).toEqual([null, null]);
    expect(colorPhoto.colorKey).toBe(e.colors[0].key);
    expect(variantPhoto.variantKey).toBe(e.variants[1].key);
    expect(e.specs).toEqual([
      {
        labelVi: "Chất liệu thân",
        labelEn: "Upper",
        valueVi: "Lưới",
        valueEn: "Mesh",
      },
      { labelVi: "Đế", labelEn: "Sole", valueVi: "Cao su", valueEn: "Rubber" },
    ]);
  });

  it("produces a product the shop can show: detail page data, list, and the switched-off variant hidden", async () => {
    const { slug } = await saved(withOptions());

    const detail = await getProductDetail(testDb, slug);
    expect(detail).toMatchObject({
      nameVi: "Giày Runner",
      nameEn: "Runner shoes",
      price: 2_000_000,
      brandName: "Zoomer",
    });
    expect(detail!.colors.map((c) => c.nameVi)).toEqual(["Đen", "Trắng"]);
    expect(detail!.sizes.map((s) => s.label)).toEqual(["41", "42"]);
    expect(detail!.variants.map((v) => [v.sku, v.price, v.stock])).toEqual([
      ["RUN-BLK-41", 2_000_000, 3],
      ["RUN-BLK-42", 2_200_000, 2],
    ]); // the off variant is not sold
    expect(detail!.images.map((i) => i.url)).toEqual([
      "/general.jpg",
      "https://cdn.example.com/black.jpg",
      "/v2.jpg",
    ]);
    expect(detail!.specs[0]).toEqual({
      key: "chat-lieu-than",
      labelVi: "Chất liệu thân",
      labelEn: "Upper",
      valueVi: "Lưới",
      valueEn: "Mesh",
    });

    const list = await listProducts(
      testDb,
      parseListParams({ q: "giay runner" }),
    );
    expect(list.items.map((p) => p.slug)).toEqual([slug]);
  });
});

describe("editing a product", () => {
  it("keeps the ids of unchanged colors and variants and updates the product fields", async () => {
    const { id } = await saved(withOptions());
    const before = await editor(id);

    await saved({
      ...before,
      price: 2_500_000,
      compareAtPrice: 3_000_000,
      nameVi: "Giày Runner 2",
      featured: true,
    });
    const after = await editor(id);

    expect(after).toMatchObject({
      price: 2_500_000,
      compareAtPrice: 3_000_000,
      nameVi: "Giày Runner 2",
      featured: true,
    });
    expect(after.variants.map((v) => v.key)).toEqual(
      before.variants.map((v) => v.key),
    );
    expect(after.colors.map((c) => c.key)).toEqual(
      before.colors.map((c) => c.key),
    );
  });

  it("is stable: saving what the editor loaded changes nothing", async () => {
    const { id } = await saved(withOptions());
    const before = await editor(id);
    await saved(before);
    expect(await editor(id)).toEqual(before);
    expect(
      await testDb.productVariant.count({ where: { productId: id } }),
    ).toBe(3);
  });

  it("adds a color with variants and removes another color with its variants", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);

    const next = {
      ...e,
      colors: [
        e.colors[0],
        { key: "new-red", nameVi: "Đỏ", nameEn: "Red", hex: "#cc0000" },
      ], // white removed, red added
      variants: [
        e.variants[0],
        e.variants[1],
        {
          key: "new-v",
          colorKey: "new-red",
          sizeId: b.s41.id,
          sku: "run-red-41",
          price: null,
          stock: 9,
          isActive: true,
        },
      ],
      images: [],
    };
    await saved(next);

    const after = await editor(id);
    expect(after.colors.map((c) => c.nameVi)).toEqual(["Đen", "Đỏ"]);
    expect(after.variants.map((v) => v.sku)).toEqual([
      "RUN-BLK-41",
      "RUN-BLK-42",
      "RUN-RED-41",
    ]);
    expect(after.images).toEqual([]);
    expect(await testDb.productColor.count({ where: { productId: id } })).toBe(
      2,
    );
  });

  it("deleting a variant keeps old orders readable", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);
    const sold = e.variants[1];
    const order = await createOrder(testDb, {
      ...validCustomer,
      items: [{ variantId: sold.key, quantity: 1 }],
    });

    // A photo that was tied to the removed variant must be released too, or the server refuses the save.
    const released = e.images.map((i) =>
      i.variantKey === sold.key ? { ...i, variantKey: null } : i,
    );
    expect(
      await saveProduct(testDb, {
        ...e,
        variants: [e.variants[0], e.variants[2]],
      }),
    ).toMatchObject({
      ok: false,
      error: {
        issues: [{ path: "images.2.variantKey", code: "unknown_variant" }],
      },
    });
    await saved({
      ...e,
      variants: [e.variants[0], e.variants[2]],
      images: released,
    });

    const item = await testDb.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(item).toMatchObject({
      variantId: null,
      productName: "Giày Runner",
      sku: "RUN-BLK-42",
      sizeLabel: "42",
      unitPrice: 2_200_000,
    });
  });

  it("can swap SKUs and color names between rows", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);
    const [a, bb, c] = e.variants;

    await saved({
      ...e,
      colors: [
        { ...e.colors[0], nameVi: "Trắng" },
        { ...e.colors[1], nameVi: "Đen" },
      ],
      variants: [{ ...a, sku: bb.sku }, { ...bb, sku: a.sku }, c],
    });

    const after = await editor(id);
    expect(after.colors.map((x) => x.nameVi)).toEqual(["Trắng", "Đen"]);
    expect(after.variants.map((v) => v.sku)).toEqual([
      "RUN-BLK-42",
      "RUN-BLK-41",
      "RUN-WHT-42",
    ]);
  });

  it("clears optional fields that were emptied", async () => {
    const { id } = await saved(
      payload({ compareAtPrice: 2_500_000, descriptionVi: "Mô tả" }),
    );
    const e = await editor(id);
    await saved({
      ...e,
      compareAtPrice: null,
      descriptionEn: "Updated description",
    });
    expect(await editor(id)).toMatchObject({
      compareAtPrice: null,
      descriptionEn: "Updated description",
    });
  });

  it("changes stock and switches a variant off", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);
    await saved({
      ...e,
      variants: e.variants.map((v, i) =>
        i === 0 ? { ...v, stock: 40, isActive: false } : v,
      ),
    });
    expect((await editor(id)).variants[0]).toMatchObject({
      stock: 40,
      isActive: false,
    });
  });

  it("keeps the first publish date, and archiving hides the product from the shop", async () => {
    const { id, slug } = await saved(payload());
    const first = (await testDb.product.findUniqueOrThrow({ where: { id } }))
      .publishedAt;

    const e = await editor(id);
    await saved({ ...e, status: "ARCHIVED" });
    expect(await getProductDetail(testDb, slug)).toBeNull();
    await saved({ ...e, status: "ACTIVE" });
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id } })).publishedAt,
    ).toEqual(first);
    expect(await getProductDetail(testDb, slug)).not.toBeNull();
  });
});

describe("problems are reported and nothing is half-saved", () => {
  it("refuses a slug that another product uses, and leaves everything unchanged", async () => {
    await saved(payload());
    const other = await saved(
      payload({
        slug: "giay-khac",
        variants: [{ key: "n", sku: "other-1", stock: 1 }],
      }),
    );
    const e = await editor(other.id);

    const result = await saveProduct(testDb, {
      ...e,
      slug: "giay-runner",
      nameVi: "Tên mới",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "slug", code: "slug_taken" }],
      },
    });
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id: other.id } }))
        .nameVi,
    ).toBe("Giày Runner");
  });

  it("points at the variant whose SKU another product already uses, and rolls the whole save back", async () => {
    await saved(
      payload({ variants: [{ key: "n", sku: "TAKEN-1", stock: 1 }] }),
    );
    const productsBefore = await testDb.product.count();

    const result = await saveProduct(
      testDb,
      payload({
        slug: "san-pham-moi",
        variants: [
          { key: "a", sku: "free-1", sizeId: b.s41.id, stock: 1 },
          { key: "b", sku: "taken-1", sizeId: b.s42.id, stock: 1 },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "variants.1.sku", code: "sku_taken" }],
      },
    });
    expect(await testDb.product.count()).toBe(productsBefore);
    expect(
      await testDb.productVariant.count({ where: { sku: "FREE-1" } }),
    ).toBe(0);
  });

  it("refuses unknown category, brand and size", async () => {
    const result = await saveProduct(
      testDb,
      payload({
        categoryId: "nope",
        brandId: "nope",
        variants: [{ key: "a", sku: "ok-1", sizeId: "no-size", stock: 1 }],
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        issues: [
          { path: "categoryId", code: "not_found" },
          { path: "brandId", code: "not_found" },
          { path: "variants.0.sizeId", code: "unknown_size" },
        ],
      },
    });
  });

  it("returns validation problems with their paths without touching the database", async () => {
    const result = await saveProduct(
      testDb,
      payload({
        slug: "Bad Slug",
        price: -5,
        variants: [{ key: "a", sku: "x", stock: -1 }],
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(result.ok === false && result.error.issues).toEqual(
      expect.arrayContaining([
        { path: "slug", code: "invalid_slug" },
        { path: "price", code: "negative" },
        { path: "variants.0.sku", code: "invalid_sku" },
        { path: "variants.0.stock", code: "negative" },
      ]),
    );
    expect(await testDb.product.count()).toBe(0);
  });

  it("says not found when updating a product that does not exist", async () => {
    expect(await saveProduct(testDb, payload({ id: "ghost" }))).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("leaves a product untouched when a later step of the update fails", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);
    await saved(
      payload({
        slug: "san-pham-khac",
        variants: [{ key: "n", sku: "OTHER-SKU", stock: 1 }],
      }),
    );

    const result = await saveProduct(testDb, {
      ...e,
      nameVi: "Sẽ không lưu",
      variants: [
        { ...e.variants[0], sku: "other-sku" },
        e.variants[1],
        e.variants[2],
      ],
    });
    expect(result.ok).toBe(false);
    const after = await editor(id);
    expect(after.nameVi).toBe("Giày Runner");
    expect(after.variants.map((v) => v.sku)).toEqual(
      e.variants.map((v) => v.sku),
    );
  });
});

describe("deleteProduct", () => {
  it("deletes a product that no order refers to, with its colors, variants and photos", async () => {
    const { id } = await saved(withOptions());
    expect(await deleteProduct(testDb, id)).toEqual({ ok: true, value: true });
    expect(await testDb.product.count()).toBe(0);
    expect(await testDb.productVariant.count()).toBe(0);
    expect(await testDb.productImage.count()).toBe(0);
    expect(await testDb.productColor.count()).toBe(0);
  });

  it("refuses to delete a product that appears in orders", async () => {
    const { id } = await saved(withOptions());
    const e = await editor(id);
    await createOrder(testDb, {
      ...validCustomer,
      items: [{ variantId: e.variants[0].key, quantity: 1 }],
    });
    expect(await deleteProduct(testDb, id)).toEqual({
      ok: false,
      error: { code: "IN_USE", usedBy: 1 },
    });
    expect(await testDb.product.count()).toBe(1);
  });

  it("reports an unknown product", async () => {
    expect(await deleteProduct(testDb, "nope")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await getAdminProduct(testDb, "nope")).toBeNull();
  });
});

describe("listAdminProducts", () => {
  beforeEach(async () => {
    await buildShop(b);
    await saved(
      payload({
        slug: "ban-nhap",
        nameVi: "Bản nháp",
        status: "DRAFT",
        variants: [{ key: "n", sku: "NHAP-1", stock: 50 }],
      }),
    );
  });

  it("lists every status with totals over the active variants only and a low-stock mark", async () => {
    const list = await listAdminProducts(testDb);
    expect(list.total).toBe(3);
    const runner = list.items.find((p) => p.slug === "zoomer-runner")!;
    expect(runner).toMatchObject({
      brandName: "Zoomer",
      categoryName: "Giày",
      variantCount: 3,
      totalStock: 8,
      lowStock: true,
      status: "ACTIVE",
      image: "/general.jpg",
    });
    const draft = list.items.find((p) => p.slug === "ban-nhap")!;
    expect(draft).toMatchObject({
      status: "DRAFT",
      totalStock: 50,
      lowStock: false,
    });
    expect(list.items.find((p) => p.slug === "tide-digital")).toMatchObject({
      totalStock: 12,
      lowStock: false,
    });
  });

  it("filters by status and category, and searches by name, URL and SKU", async () => {
    const slugs = async (f: Parameters<typeof listAdminProducts>[1]) =>
      (await listAdminProducts(testDb, f)).items.map((p) => p.slug).sort();
    expect(await slugs({ status: "DRAFT" })).toEqual(["ban-nhap"]);
    expect(await slugs({ categoryId: b.watches.id })).toEqual(["tide-digital"]);
    expect(await slugs({ q: "bản nháp" })).toEqual(["ban-nhap"]);
    expect(await slugs({ q: "tide-digi" })).toEqual(["tide-digital"]);
    expect(await slugs({ q: "zoom-run-blk" })).toEqual(["zoomer-runner"]); // part of a SKU, any letter case
    expect(await slugs({ q: "khongco" })).toEqual([]);
  });

  it("paginates by 20", async () => {
    for (let i = 0; i < 20; i++)
      await saved(
        payload({
          slug: `extra-${i}`,
          nameVi: `Extra ${i}`,
          variants: [{ key: "n", sku: `EX-${i}`, stock: 1 }],
        }),
      );
    const first = await listAdminProducts(testDb, { page: 1 });
    expect(first).toMatchObject({ total: 23, pageCount: 2 });
    expect(first.items).toHaveLength(20);
    expect((await listAdminProducts(testDb, { page: 2 })).items).toHaveLength(
      3,
    );
  });
});

describe("English fields left empty", () => {
  const vietnameseOnly = (): ProductFormInput =>
    payload({
      nameEn: "",
      descriptionEn: "",
      colors: [{ key: "c1", nameVi: "Đen", nameEn: "" }],
      variants: [{ key: "v1", colorKey: "c1", sku: "run-blk", stock: 1 }],
    });
  const fake = async (texts: string[]) => texts.map((t) => `EN(${t})`);

  it("are translated before saving when a translator is available", async () => {
    const r = await saveProduct(testDb, vietnameseOnly(), fake);
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    const e = await editor(r.value.id);
    expect(e).toMatchObject({
      nameEn: "EN(Giày Runner)",
      descriptionEn: "EN(Mô tả giày)",
    });
    expect(e.colors[0].nameEn).toBe("EN(Đen)");
  });

  it("are reported as required (English stays compulsory) without a translator or when it fails", async () => {
    for (const translate of [undefined, async () => null]) {
      const r = await saveProduct(testDb, vietnameseOnly(), translate);
      expect(r).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
      const paths = r.ok ? [] : (r.error.issues ?? []).map((i) => i.path);
      expect(paths).toEqual(
        expect.arrayContaining(["nameEn", "descriptionEn", "colors.0.nameEn"]),
      );
    }
    expect((await listAdminProducts(testDb, {} as never)).total).toBe(0);
  });

  it("keeps English the owner typed", async () => {
    const r = await saveProduct(
      testDb,
      { ...vietnameseOnly(), nameEn: "My own name" },
      fake,
    );
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(await editor(r.value.id)).toMatchObject({
      nameEn: "My own name",
      descriptionEn: "EN(Mô tả giày)",
    });
  });
});
