// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { basics, buildShop, resetDb, testDb } from "../../test/db";
import { createProduct } from "./create-product";
import { searchProducts } from "./search-products";

let b: Awaited<ReturnType<typeof basics>>;
let shop: Awaited<ReturnType<typeof buildShop>>;

beforeEach(async () => {
  await resetDb();
  b = await basics();
  shop = await buildShop(b);
});

describe("variants are optional but every product has at least one", () => {
  it("creates one default variant (no color, no size) for a product without options", () => {
    expect(shop.watch.variants).toHaveLength(1);
    expect(shop.digi).toMatchObject({ colorId: null, sizeId: null, sku: "TIDE-DIGI", stock: 12 });
  });

  it("refuses a product with neither variants nor a default variant", async () => {
    await expect(
      createProduct(testDb, { slug: "x", categoryId: b.shoes.id, brandId: b.brand.id, nameVi: "X", price: 1 }),
    ).rejects.toThrow(/defaultVariant/);
  });

  it("gives each color+size combination its own variant, SKU and stock", () => {
    const skus = shop.shoe.variants.map((v) => v.sku).sort();
    expect(skus).toEqual(["ZOOM-RUN-BLK-41", "ZOOM-RUN-BLK-42", "ZOOM-RUN-WHT-42"]);
    expect(shop.blk42.price).toBe(2_490_000);
    expect(shop.blk41.price).toBeNull();
  });
});

describe("database rules", () => {
  it("rejects a second variant with the same product, color and size", async () => {
    await expect(
      testDb.productVariant.create({
        data: { productId: shop.shoe.id, colorId: shop.blk42.colorId, sizeId: b.s42.id, sku: "DUP-1", stock: 1 },
      }),
    ).rejects.toThrow();
  });

  it("rejects a second option-less variant (NULL color and size) for the same product", async () => {
    await expect(
      testDb.productVariant.create({ data: { productId: shop.watch.id, sku: "DUP-2", stock: 1 } }),
    ).rejects.toThrow();
  });

  it("allows the same color with a different size", async () => {
    await expect(
      testDb.productVariant.create({
        data: { productId: shop.shoe.id, colorId: shop.blk42.colorId, sizeId: (await testDb.size.create({ data: { type: "SHOE", label: "43", position: 4 } })).id, sku: "OK-43", stock: 1 },
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects duplicate SKUs", async () => {
    await expect(
      testDb.productVariant.create({ data: { productId: shop.watch.id, sku: "TIDE-DIGI", sizeId: b.w40.id } }),
    ).rejects.toThrow();
  });

  it("rejects negative stock and negative prices", async () => {
    await expect(testDb.productVariant.update({ where: { id: shop.digi.id }, data: { stock: -1 } })).rejects.toThrow();
    await expect(testDb.productVariant.update({ where: { id: shop.digi.id }, data: { price: -5 } })).rejects.toThrow();
  });

  it("rejects a photo tied to both a variant and a color", async () => {
    await expect(
      testDb.productImage.create({
        data: { productId: shop.shoe.id, variantId: shop.blk42.id, colorId: shop.blk42.colorId, url: "/x.jpg" },
      }),
    ).rejects.toThrow();
  });

  it("deleting a product removes its colors, variants and photos", async () => {
    await testDb.product.delete({ where: { id: shop.shoe.id } });
    expect(await testDb.productVariant.count({ where: { productId: shop.shoe.id } })).toBe(0);
    expect(await testDb.productColor.count({ where: { productId: shop.shoe.id } })).toBe(0);
    expect(await testDb.productImage.count({ where: { productId: shop.shoe.id } })).toBe(0);
  });

  it("cannot delete a size that a variant uses, but can delete an unused one", async () => {
    await expect(testDb.size.delete({ where: { id: b.s42.id } })).rejects.toThrow();
    await expect(testDb.size.delete({ where: { id: b.w40.id } })).resolves.toBeTruthy();
  });
});

describe("sizes", () => {
  it("come back in the owner's order, so 9, 10, 11 are not sorted as text", async () => {
    await testDb.size.createMany({
      data: [
        { type: "SHOE", label: "11", position: 30 },
        { type: "SHOE", label: "9", position: 10 },
        { type: "SHOE", label: "10", position: 20 },
      ],
    });
    const labels = (await testDb.size.findMany({ where: { label: { in: ["9", "10", "11"] } }, orderBy: { position: "asc" } })).map(
      (s) => s.label,
    );
    expect(labels).toEqual(["9", "10", "11"]);
  });
});

describe("searchProducts", () => {
  it.each(["giay", "GIÀY", "Giày", "zoomer", "runner giay"])("finds the shoe for %j", async (query) => {
    expect((await searchProducts(testDb, query)).map((p) => p.slug)).toContain("zoomer-runner");
  });

  it("requires every word to match", async () => {
    expect(await searchProducts(testDb, "zoomer khongco")).toEqual([]);
  });

  it("finds watches without diacritics", async () => {
    expect((await searchProducts(testDb, "dong ho")).map((p) => p.slug)).toEqual(["tide-digital"]);
    expect((await searchProducts(testDb, "Đồng hồ")).map((p) => p.slug)).toEqual(["tide-digital"]);
  });

  it("ignores draft products and empty queries", async () => {
    await createProduct(testDb, {
      slug: "draft-shoe",
      categoryId: b.shoes.id,
      brandId: b.brand.id,
      nameVi: "Giày nháp",
      price: 1,
      defaultVariant: { sku: "DRAFT-1" },
    });
    expect((await searchProducts(testDb, "nhap")).map((p) => p.slug)).toEqual([]);
    expect(await searchProducts(testDb, "   ")).toEqual([]);
  });
});
