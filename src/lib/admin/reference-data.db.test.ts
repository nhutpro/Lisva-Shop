// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { basics, buildShop, resetDb, testDb } from "../../test/db";
import {
  deleteBrand,
  deleteCategory,
  deleteSize,
  listBrands,
  listCategories,
  listSizes,
  saveBrand,
  saveCategory,
  saveSize,
} from "./reference-data";

let b: Awaited<ReturnType<typeof basics>>;

beforeEach(async () => {
  await resetDb();
  b = await basics();
});

const value = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error(`expected success: ${JSON.stringify(r)}`);
  return r.value;
};

describe("brands", () => {
  it("creates a brand with an upper-case SKU prefix and lists it with its product count", async () => {
    const created = value(
      await saveBrand(testDb, {
        name: " Nike ",
        slug: "nike",
        skuPrefix: "nke",
      }),
    );
    expect(created).toMatchObject({
      name: "Nike",
      slug: "nike",
      skuPrefix: "NKE",
      productCount: 0,
    });

    await buildShop(b);
    const list = await listBrands(testDb);
    expect(list.map((x) => [x.name, x.productCount])).toEqual([
      ["Nike", 0],
      ["Zoomer", 2],
    ]);
  });

  it("updates a brand", async () => {
    const created = value(
      await saveBrand(testDb, { name: "Nike", slug: "nike", skuPrefix: "NKE" }),
    );
    const updated = value(
      await saveBrand(
        testDb,
        { name: "Nike Inc", slug: "nike", skuPrefix: "NKE" },
        created.id,
      ),
    );
    expect(updated.name).toBe("Nike Inc");
    expect(await testDb.brand.count({ where: { slug: "nike" } })).toBe(1);
  });

  it("reports problems per field and refuses duplicates", async () => {
    expect(
      await saveBrand(testDb, { name: "", slug: "Bad Slug", skuPrefix: "x" }),
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        issues: [
          { path: "name", code: "required" },
          { path: "slug", code: "invalid_slug" },
          { path: "skuPrefix", code: "invalid_sku" },
        ],
      },
    });
    await saveBrand(testDb, { name: "Nike", slug: "nike", skuPrefix: "NKE" });
    expect(
      await saveBrand(testDb, {
        name: "Nike 2",
        slug: "nike",
        skuPrefix: "NK2",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "slug", code: "slug_taken" }],
      },
    });
    expect(
      await saveBrand(testDb, {
        name: "Nike 3",
        slug: "nike-3",
        skuPrefix: "nke",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "skuPrefix", code: "prefix_taken" }],
      },
    });
  });

  it("cannot be deleted while products use it, and can be afterwards", async () => {
    const shop = await buildShop(b);
    expect(await deleteBrand(testDb, b.brand.id)).toEqual({
      ok: false,
      error: { code: "IN_USE", usedBy: 2 },
    });
    await testDb.product.deleteMany({
      where: { id: { in: [shop.shoe.id, shop.watch.id] } },
    });
    expect(await deleteBrand(testDb, b.brand.id)).toEqual({
      ok: true,
      value: true,
    });
    expect(await deleteBrand(testDb, b.brand.id)).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("categories", () => {
  it("creates a sub-category under a top-level category", async () => {
    const created = value(
      await saveCategory(testDb, {
        nameVi: "Giày chạy bộ",
        nameEn: "Running",
        slug: "chay-bo",
        parentId: b.shoes.id,
        position: "2",
      }),
    );
    expect(created).toMatchObject({
      nameVi: "Giày chạy bộ",
      nameEn: "Running",
      parentId: b.shoes.id,
      position: 2,
      childCount: 0,
    });
    const list = await listCategories(testDb);
    expect(list.find((c) => c.id === b.shoes.id)?.childCount).toBe(1);
  });

  it("allows only two levels and no cycles", async () => {
    const child = value(
      await saveCategory(testDb, {
        nameVi: "Sneaker",
        nameEn: "English",
        slug: "sneaker",
        parentId: b.shoes.id,
      }),
    );
    const tooDeep = await saveCategory(testDb, {
      nameVi: "Cổ thấp",
      nameEn: "English",
      slug: "co-thap",
      parentId: child.id,
    });
    expect(tooDeep).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        issues: [{ path: "parentId", code: "invalid" }],
      },
    });

    const self = await saveCategory(
      testDb,
      { nameVi: "Giày", nameEn: "English", slug: "giay", parentId: b.shoes.id },
      b.shoes.id,
    );
    expect(self.ok).toBe(false);
    // A category that already has children cannot move under another one.
    const moved = await saveCategory(
      testDb,
      {
        nameVi: "Giày",
        nameEn: "English",
        slug: "giay",
        parentId: b.watches.id,
      },
      b.shoes.id,
    );
    expect(moved.ok).toBe(false);
  });

  it("refuses an unknown parent and a taken slug", async () => {
    expect(
      await saveCategory(testDb, {
        nameVi: "X",
        nameEn: "English",
        slug: "x",
        parentId: "nope",
      }),
    ).toMatchObject({
      ok: false,
      error: { issues: [{ path: "parentId", code: "not_found" }] },
    });
    expect(
      await saveCategory(testDb, {
        nameVi: "X",
        nameEn: "English",
        slug: "giay",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "slug", code: "slug_taken" }],
      },
    });
  });

  it("updates names and keeps the English name optional", async () => {
    const updated = value(
      await saveCategory(
        testDb,
        { nameVi: "Giày dép", nameEn: "Footwear", slug: "giay" },
        b.shoes.id,
      ),
    );
    expect(updated).toMatchObject({ nameVi: "Giày dép", nameEn: "Footwear" });
  });

  it("cannot be deleted while it has products or sub-categories", async () => {
    await buildShop(b);
    expect(await deleteCategory(testDb, b.shoes.id)).toEqual({
      ok: false,
      error: { code: "IN_USE", usedBy: 1 },
    });
    const empty = value(
      await saveCategory(testDb, {
        nameVi: "Trống",
        nameEn: "English",
        slug: "trong",
      }),
    );
    expect(await deleteCategory(testDb, empty.id)).toEqual({
      ok: true,
      value: true,
    });
    const parent = value(
      await saveCategory(testDb, {
        nameVi: "Cha",
        nameEn: "English",
        slug: "cha",
      }),
    );
    await saveCategory(testDb, {
      nameVi: "Con",
      nameEn: "English",
      slug: "con",
      parentId: parent.id,
    });
    expect(await deleteCategory(testDb, parent.id)).toMatchObject({
      ok: false,
      error: { code: "IN_USE" },
    });
  });
});

describe("sizes", () => {
  it("creates shoe and watch sizes, with foot length only where given", async () => {
    const shoe = value(
      await saveSize(testDb, {
        type: "SHOE",
        label: "43",
        position: "43",
        footLengthCm: "27",
        usSize: "10",
      }),
    );
    expect(shoe).toMatchObject({
      type: "SHOE",
      label: "43",
      position: 43,
      footLengthCm: 27,
      usSize: "10",
    });
    const watch = value(
      await saveSize(testDb, {
        type: "WATCH",
        label: "42mm",
        position: 42,
        footLengthCm: "",
        usSize: "",
      }),
    );
    expect(watch).toMatchObject({ footLengthCm: null, usSize: null });
  });

  it("lists sizes by type and position with how many variants use each", async () => {
    await buildShop(b);
    const list = await listSizes(testDb);
    expect(list.map((s) => [s.type, s.label, s.variantCount])).toEqual([
      ["SHOE", "41", 1],
      ["SHOE", "42", 2],
      ["WATCH", "40mm", 0],
    ]);
  });

  it("validates the fields and refuses a duplicate label of the same type", async () => {
    expect(
      await saveSize(testDb, { type: "BOOT", label: "", footLengthCm: "5" }),
    ).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        issues: expect.arrayContaining([
          { path: "type", code: "invalid" },
          { path: "label", code: "required" },
          { path: "footLengthCm", code: "too_short" },
        ]),
      },
    });
    expect(await saveSize(testDb, { type: "SHOE", label: "41" })).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        issues: [{ path: "label", code: "label_taken" }],
      },
    });
    expect((await saveSize(testDb, { type: "WATCH", label: "41" })).ok).toBe(
      true,
    ); // same label, other type
  });

  it("cannot be deleted while a variant uses it", async () => {
    await buildShop(b);
    expect(await deleteSize(testDb, b.s42.id)).toEqual({
      ok: false,
      error: { code: "IN_USE", usedBy: 2 },
    });
    expect(await deleteSize(testDb, b.w40.id)).toEqual({
      ok: true,
      value: true,
    });
  });
});

describe("category English name", () => {
  it("is translated when empty and a translator is available, required otherwise", async () => {
    const fake = async (texts: string[]) => texts.map((t) => `EN(${t})`);
    const made = value(
      await saveCategory(
        testDb,
        { nameVi: "Dép", slug: "dep" },
        undefined,
        fake,
      ),
    );
    expect(made.nameEn).toBe("EN(Dép)");
    expect(
      await saveCategory(testDb, { nameVi: "Túi", slug: "tui" }),
    ).toMatchObject({ ok: false });
    expect(
      await saveCategory(
        testDb,
        { nameVi: "Túi", slug: "tui" },
        undefined,
        async () => null,
      ),
    ).toMatchObject({ ok: false });
  });
});
