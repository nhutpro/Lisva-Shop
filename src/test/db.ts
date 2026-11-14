import { PrismaClient } from "@prisma/client";
import { afterAll } from "vitest";
import { createProduct } from "../lib/catalog/create-product";

try {
  process.loadEnvFile(".env");
} catch {
  // optional
}

const url = process.env.DATABASE_URL_TEST;
// Safety: these helpers wipe tables, so they must never touch the development database.
if (!url?.includes("lisva_test")) {
  throw new Error("Refusing to run: DATABASE_URL_TEST must point to the lisva_test database.");
}

export const testDb = new PrismaClient({ datasources: { db: { url } } });

afterAll(() => testDb.$disconnect());

export async function resetDb() {
  await testDb.$executeRawUnsafe(
    `TRUNCATE "OrderNote","OrderStatusHistory","OrderItem","Order","ProductImage","ProductVariant","ProductColor","Product","Size","Brand","Category","Address","Account","Session","VerificationToken","User" RESTART IDENTITY CASCADE`,
  );
}

/** Category, brand and a few sizes shared by most tests. */
export async function basics() {
  const [shoes, watches] = await Promise.all([
    testDb.category.create({ data: { slug: "giay", nameVi: "Giày", nameEn: "Shoes" } }),
    testDb.category.create({ data: { slug: "dong-ho", nameVi: "Đồng hồ", nameEn: "Watches" } }),
  ]);
  const brand = await testDb.brand.create({ data: { slug: "zoomer", name: "Zoomer", skuPrefix: "ZOOM" } });
  const size = async (type: "SHOE" | "WATCH", label: string, position: number) =>
    testDb.size.create({ data: { type, label, position } });
  return {
    shoes,
    watches,
    brand,
    s41: await size("SHOE", "41", 2),
    s42: await size("SHOE", "42", 3),
    w40: await size("WATCH", "40mm", 2),
  };
}

type Basics = Awaited<ReturnType<typeof basics>>;

/** A shoe with colors and sizes, and a watch with no options at all. */
export async function buildShop(b: Basics) {
  const shoe = await createProduct(testDb, {
    slug: "zoomer-runner",
    categoryId: b.shoes.id,
    brandId: b.brand.id,
    nameVi: "Zoomer Runner",
    nameEn: "Zoomer Runner",
    price: 2_390_000,
    status: "ACTIVE",
    colors: [{ nameVi: "Đen" }, { nameVi: "Trắng" }],
    variants: [
      { sku: "ZOOM-RUN-BLK-41", color: "Đen", sizeId: b.s41.id, stock: 5 },
      { sku: "ZOOM-RUN-BLK-42", color: "Đen", sizeId: b.s42.id, stock: 3, price: 2_490_000 },
      { sku: "ZOOM-RUN-WHT-42", color: "Trắng", sizeId: b.s42.id, stock: 0 },
    ],
    images: [
      { url: "/general.jpg" },
      { url: "/black.jpg", color: "Đen" },
      { url: "/black-42.jpg", variantSku: "ZOOM-RUN-BLK-42" },
    ],
  });
  const watch = await createProduct(testDb, {
    slug: "tide-digital",
    categoryId: b.watches.id,
    brandId: b.brand.id,
    nameVi: "Tide Digital Pocket",
    price: 590_000,
    status: "ACTIVE",
    defaultVariant: { sku: "TIDE-DIGI", stock: 12 },
  });
  const variant = (product: typeof shoe, sku: string) => {
    const v = product.variants.find((x) => x.sku === sku);
    if (!v) throw new Error(`No variant ${sku}`);
    return v;
  };
  return {
    shoe,
    watch,
    blk41: variant(shoe, "ZOOM-RUN-BLK-41"),
    blk42: variant(shoe, "ZOOM-RUN-BLK-42"),
    wht42: variant(shoe, "ZOOM-RUN-WHT-42"),
    digi: variant(watch, "TIDE-DIGI"),
  };
}

export const validCustomer = {
  customerName: "Nguyễn An",
  phone: "0912 345 678",
  preferredContact: "ZALO" as const,
  province: "TP. Hồ Chí Minh",
  district: "Quận 1",
  ward: "Phường Bến Nghé",
  street: "12 Lê Lợi",
};
