// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "../../test/db";
import { createProduct } from "./create-product";
import { PAGE_SIZE, parseListParams, type RawSearchParams } from "./parse-list-params";
import { getCategories, getHomeData, getListFacets, getProductDetail, listProducts } from "./queries-core";

const list = (raw: RawSearchParams = {}) => listProducts(testDb, parseListParams(raw));
const slugs = async (raw: RawSearchParams = {}) => (await list(raw)).items.map((p) => p.slug);

let ids: {
  shoes: string; running: string; watches: string;
  zoomer: string; tide: string;
  s41: string; s42: string; w40: string;
};

beforeEach(async () => {
  await resetDb();
  const shoes = await testDb.category.create({ data: { slug: "giay", nameVi: "Giày", nameEn: "Shoes", position: 1 } });
  const running = await testDb.category.create({
    data: { slug: "giay-chay-bo", nameVi: "Giày chạy bộ", parentId: shoes.id },
  });
  const watches = await testDb.category.create({ data: { slug: "dong-ho", nameVi: "Đồng hồ", nameEn: "Watches", position: 2 } });
  const zoomer = await testDb.brand.create({ data: { slug: "zoomer", name: "Zoomer", skuPrefix: "ZOOM" } });
  const tide = await testDb.brand.create({ data: { slug: "tide", name: "Tide", skuPrefix: "TIDE" } });
  const size = (type: "SHOE" | "WATCH", label: string, position: number, extra = {}) =>
    testDb.size.create({ data: { type, label, position, ...extra } });
  const s41 = await size("SHOE", "41", 41, { footLengthCm: 25.5, usSize: "8" });
  const s42 = await size("SHOE", "42", 42, { footLengthCm: 26.5, usSize: "9" });
  const w40 = await size("WATCH", "40mm", 40);
  ids = { shoes: shoes.id, running: running.id, watches: watches.id, zoomer: zoomer.id, tide: tide.id, s41: s41.id, s42: s42.id, w40: w40.id };

  // Created in this order, so "newest first" is: watch-b, watch-a, trail, runner.
  await createProduct(testDb, {
    slug: "runner", categoryId: running.id, brandId: zoomer.id, nameVi: "Giày chạy bộ Runner", nameEn: "Runner",
    price: 2_000_000, compareAtPrice: 2_500_000, status: "ACTIVE", featured: true,
    colors: [{ nameVi: "Đen", hex: "#111111" }, { nameVi: "Trắng" }],
    variants: [
      { sku: "R-BLK-41", color: "Đen", sizeId: s41.id, stock: 3 },
      { sku: "R-BLK-42", color: "Đen", sizeId: s42.id, stock: 0, price: 2_200_000 },
      { sku: "R-WHT-42", color: "Trắng", sizeId: s42.id, stock: 1 },
    ],
    images: [{ url: "/color.jpg", color: "Đen" }, { url: "/general.jpg" }],
  });
  await createProduct(testDb, {
    slug: "trail", categoryId: shoes.id, brandId: zoomer.id, nameVi: "Giày địa hình Trail",
    price: 3_000_000, status: "ACTIVE",
    colors: [{ nameVi: "Cam" }],
    variants: [{ sku: "T-ORG-42", color: "Cam", sizeId: s42.id, stock: 2 }],
  });
  await createProduct(testDb, {
    slug: "watch-a", categoryId: watches.id, brandId: tide.id, nameVi: "Đồng hồ Tide A",
    price: 4_000_000, status: "ACTIVE", featured: true,
    colors: [{ nameVi: "Đen" }],
    variants: [{ sku: "WA-BLK-40", color: "Đen", sizeId: w40.id, stock: 5 }],
    specs: [{ key: "movement", labelVi: "Bộ máy", valueVi: "Cơ" }],
  });
  await createProduct(testDb, {
    slug: "watch-b", categoryId: watches.id, brandId: tide.id, nameVi: "Đồng hồ Tide B không tồn kho",
    price: 500_000, status: "ACTIVE", defaultVariant: { sku: "WB", stock: 0 },
  });
  await createProduct(testDb, {
    slug: "hidden-draft", categoryId: shoes.id, brandId: zoomer.id, nameVi: "Giày nháp",
    price: 1, status: "DRAFT", defaultVariant: { sku: "DRAFT", stock: 9 },
  });
});

describe("listProducts: what is listed", () => {
  it("lists active products only, newest first by default", async () => {
    expect(await slugs()).toEqual(["watch-b", "watch-a", "trail", "runner"]);
  });

  it("filters by category and includes its sub-categories", async () => {
    expect((await slugs({ category: "giay" })).sort()).toEqual(["runner", "trail"]);
    expect(await slugs({ category: "giay-chay-bo" })).toEqual(["runner"]);
    expect((await slugs({ category: "dong-ho" })).sort()).toEqual(["watch-a", "watch-b"]);
    expect(await slugs({ category: "khong-co" })).toEqual([]);
  });

  it("filters by brand, several brands at once", async () => {
    expect((await slugs({ brand: "tide" })).sort()).toEqual(["watch-a", "watch-b"]);
    expect((await slugs({ brand: ["tide", "zoomer"] })).length).toBe(4);
  });

  it("filters by price range on the base price", async () => {
    expect((await slugs({ minPrice: "2500000", maxPrice: "4000000" })).sort()).toEqual(["trail", "watch-a"]);
    expect(await slugs({ maxPrice: "600000" })).toEqual(["watch-b"]);
  });

  it("filters by size and color using active variants", async () => {
    expect((await slugs({ size: "42" })).sort()).toEqual(["runner", "trail"]);
    expect(await slugs({ size: "41" })).toEqual(["runner"]);
    expect(await slugs({ size: "40mm" })).toEqual(["watch-a"]);
    expect((await slugs({ color: "Đen" })).sort()).toEqual(["runner", "watch-a"]);
    expect(await slugs({ size: "42", color: "Cam" })).toEqual(["trail"]);
  });

  it("ignores variants that are switched off when filtering by size", async () => {
    await testDb.productVariant.updateMany({ where: { sku: "T-ORG-42" }, data: { isActive: false } });
    expect(await slugs({ size: "42" })).toEqual(["runner"]);
  });

  it("searches ignoring case and diacritics, every word must match", async () => {
    expect(await slugs({ q: "giay" })).toEqual(expect.arrayContaining(["runner", "trail"]));
    expect((await slugs({ q: "GIÀY" })).includes("hidden-draft")).toBe(false);
    expect((await slugs({ q: "dong ho" })).sort()).toEqual(["watch-a", "watch-b"]);
    expect(await slugs({ q: "tide ton kho" })).toEqual(["watch-b"]);
    expect(await slugs({ q: "tide khongco" })).toEqual([]);
  });

  it("combines search with filters", async () => {
    expect(await slugs({ q: "giay", brand: "zoomer", maxPrice: "2500000" })).toEqual(["runner"]);
  });

  it("sorts by price", async () => {
    expect(await slugs({ sort: "price-asc" })).toEqual(["watch-b", "runner", "trail", "watch-a"]);
    expect(await slugs({ sort: "price-desc" })).toEqual(["watch-a", "trail", "runner", "watch-b"]);
  });
});

describe("listProducts: pagination", () => {
  beforeEach(async () => {
    for (let i = 1; i <= 14; i++) {
      await createProduct(testDb, {
        slug: `extra-${String(i).padStart(2, "0")}`, categoryId: ids.shoes, brandId: ids.zoomer,
        nameVi: `Extra ${i}`, price: 1_000_000 + i, status: "ACTIVE", defaultVariant: { sku: `X${i}`, stock: 1 },
      });
    }
  });

  it("splits into pages of 12 and reports totals", async () => {
    const first = await list();
    expect(first).toMatchObject({ total: 18, page: 1, pageCount: 2 });
    expect(first.items).toHaveLength(PAGE_SIZE);
    const second = await list({ page: "2" });
    expect(second.items).toHaveLength(6);
    expect(new Set([...first.items, ...second.items].map((p) => p.id)).size).toBe(18);
  });

  it("shows the last page when the page number is too high", async () => {
    expect(await list({ page: "50" })).toMatchObject({ page: 2, pageCount: 2 });
  });

  it("reports one empty page for no results", async () => {
    expect(await list({ q: "khongcoai" })).toMatchObject({ total: 0, page: 1, pageCount: 1, items: [] });
  });
});

describe("product cards", () => {
  it("shows a 'from' price when variants differ, the sale price and the general photo", async () => {
    const runner = (await list({ q: "runner" })).items[0];
    expect(runner).toMatchObject({
      slug: "runner",
      brandName: "Zoomer",
      fromPrice: 2_000_000,
      priceVaries: true,
      compareAtPrice: 2_500_000,
      inStock: true,
      image: { url: "/general.jpg" },
    });
    expect(runner.colors.map((c) => c.nameVi)).toEqual(["Đen", "Trắng"]);
  });

  it("marks a product sold out when no active variant has stock, and has no photo when it has none", async () => {
    const watchB = (await list({ q: "ton kho" })).items[0];
    expect(watchB).toMatchObject({ inStock: false, priceVaries: false, fromPrice: 500_000, image: null });
  });

  it("returns plain data that can be serialized", async () => {
    const result = await list();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe("getListFacets", () => {
  it("returns brands, sizes in numeric order, distinct colors and price bounds for a category", async () => {
    const f = await getListFacets(testDb, "giay");
    expect(f.brands).toEqual([{ slug: "zoomer", name: "Zoomer" }]);
    expect(f.sizes.map((s) => s.label)).toEqual(["41", "42"]);
    expect(f.colors).toHaveLength(3); // "Đen" is listed once even if several products use it
    expect(new Set(f.colors.map((c) => c.nameVi))).toEqual(new Set(["Đen", "Trắng", "Cam"]));
    expect([f.priceMin, f.priceMax]).toEqual([2_000_000, 3_000_000]);
  });

  it("covers all active products without a category and ignores drafts", async () => {
    const f = await getListFacets(testDb);
    expect(f.brands.map((b) => b.slug)).toEqual(["tide", "zoomer"]);
    expect(f.priceMin).toBe(500_000);
    expect(new Set(f.colors.map((c) => c.nameVi)).size).toBe(3);
  });
});

describe("getCategories", () => {
  it("counts active products, including sub-categories", async () => {
    const cats = Object.fromEntries((await getCategories(testDb)).map((c) => [c.slug, c]));
    expect(cats["giay"].count).toBe(2);
    expect(cats["giay-chay-bo"]).toMatchObject({ count: 1, parentSlug: "giay" });
    expect(cats["dong-ho"].count).toBe(2);
  });
});

describe("getProductDetail", () => {
  it("returns variants with effective prices, sizes with foot length as numbers, and photos", async () => {
    const d = await getProductDetail(testDb, "runner");
    expect(d).not.toBeNull();
    expect(d!.variants.map((v) => [v.sku, v.price, v.stock])).toEqual([
      ["R-BLK-41", 2_000_000, 3],
      ["R-BLK-42", 2_200_000, 0],
      ["R-WHT-42", 2_000_000, 1],
    ]);
    expect(d!.sizes).toEqual([
      { id: ids.s41, label: "41", type: "SHOE", footLengthCm: 25.5, usSize: "8" },
      { id: ids.s42, label: "42", type: "SHOE", footLengthCm: 26.5, usSize: "9" },
    ]);
    expect(d!.colors.map((c) => c.nameVi)).toEqual(["Đen", "Trắng"]);
    expect(d!.images.map((i) => i.url)).toEqual(["/color.jpg", "/general.jpg"]);
    expect(d!.images[0].colorId).toBe(d!.colors[0].id);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });

  it("returns the spec table and falls back to an empty one when the stored specs are invalid", async () => {
    expect((await getProductDetail(testDb, "watch-a"))!.specs).toEqual([{ key: "movement", labelVi: "Bộ máy", valueVi: "Cơ" }]);
    await testDb.product.update({ where: { slug: "watch-a" }, data: { specs: [{ nonsense: true }] } });
    expect((await getProductDetail(testDb, "watch-a"))!.specs).toEqual([]);
  });

  it("hides switched-off variants, and has no pickers for a product without options", async () => {
    await testDb.productVariant.updateMany({ where: { sku: "R-WHT-42" }, data: { isActive: false } });
    expect((await getProductDetail(testDb, "runner"))!.variants).toHaveLength(2);

    const b = await getProductDetail(testDb, "watch-b");
    expect(b).toMatchObject({ colors: [], sizes: [] });
    expect(b!.variants).toHaveLength(1);
    expect(b!.variants[0]).toMatchObject({ colorId: null, sizeId: null });
  });

  it("returns null for unknown and draft products", async () => {
    expect(await getProductDetail(testDb, "nope")).toBeNull();
    expect(await getProductDetail(testDb, "hidden-draft")).toBeNull();
  });
});

describe("getHomeData", () => {
  it("returns featured products, the newest products and categories", async () => {
    const home = await getHomeData(testDb);
    expect(home.featured.map((p) => p.slug).sort()).toEqual(["runner", "watch-a"]);
    expect(home.newest.map((p) => p.slug)).toEqual(["watch-b", "watch-a", "trail", "runner"]);
    expect(home.categories.map((c) => c.slug)).toContain("giay");
  });
});
