// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { basics, buildShop, resetDb, testDb } from "../../test/db";
import { MAX_CART_LINES, getCartLines } from "./cart-lines";

let shop: Awaited<ReturnType<typeof buildShop>>;

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
});

describe("getCartLines", () => {
  it("returns current names, price, stock, color, size and the right photo for each variant", async () => {
    const lines = await getCartLines(testDb, [shop.blk42.id, shop.digi.id]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      variantId: shop.blk42.id,
      productSlug: "zoomer-runner",
      nameVi: "Zoomer Runner",
      brandName: "Zoomer",
      colorNameVi: "Đen",
      sizeLabel: "42",
      sku: "ZOOM-RUN-BLK-42",
      unitPrice: 2_490_000, // the variant's own price
      stock: 3,
      available: true,
      image: { url: "/black-42.jpg" }, // the variant's own photo wins
    });
    expect(lines[1]).toMatchObject({ sku: "TIDE-DIGI", colorNameVi: null, sizeLabel: null, unitPrice: 590_000, image: null });
  });

  it("follows the requested order and ignores duplicates", async () => {
    const lines = await getCartLines(testDb, [shop.digi.id, shop.blk41.id, shop.digi.id]);
    expect(lines.map((l) => l.sku)).toEqual(["TIDE-DIGI", "ZOOM-RUN-BLK-41"]);
  });

  it("leaves out ids that do not exist and returns nothing for an empty cart", async () => {
    expect((await getCartLines(testDb, ["nope", shop.digi.id])).map((l) => l.sku)).toEqual(["TIDE-DIGI"]);
    expect(await getCartLines(testDb, [])).toEqual([]);
  });

  it("reflects price and stock changes made after the item was added", async () => {
    await testDb.product.update({ where: { id: shop.watch.id }, data: { price: 700_000, nameVi: "Tên mới" } });
    await testDb.productVariant.update({ where: { id: shop.digi.id }, data: { stock: 1 } });

    const [line] = await getCartLines(testDb, [shop.digi.id]);
    expect(line).toMatchObject({ nameVi: "Tên mới", unitPrice: 700_000, stock: 1 });
  });

  it("marks variants as unavailable when switched off or when the product is hidden, but still returns them", async () => {
    await testDb.productVariant.update({ where: { id: shop.blk41.id }, data: { isActive: false } });
    await testDb.product.update({ where: { id: shop.watch.id }, data: { status: "ARCHIVED" } });

    const lines = await getCartLines(testDb, [shop.blk41.id, shop.digi.id, shop.blk42.id]);
    expect(lines.map((l) => [l.sku, l.available])).toEqual([
      ["ZOOM-RUN-BLK-41", false],
      ["TIDE-DIGI", false],
      ["ZOOM-RUN-BLK-42", true],
    ]);
  });

  it("looks up at most 30 variants", async () => {
    const lines = await getCartLines(testDb, [shop.digi.id, ...Array.from({ length: 60 }, (_, i) => `missing-${i}`)]);
    expect(lines).toHaveLength(1);
    expect(MAX_CART_LINES).toBe(30);
  });

  it("returns data that can be serialized", async () => {
    const lines = await getCartLines(testDb, [shop.blk42.id]);
    expect(JSON.parse(JSON.stringify(lines))).toEqual(lines);
  });
});
