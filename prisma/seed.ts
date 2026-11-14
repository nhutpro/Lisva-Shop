// Development seed: fictional brands and products so the shop has something to show.
// WARNING: wipes catalog and order data first. Local database only.
import { PrismaClient } from "@prisma/client";
import { createProduct } from "../src/lib/catalog/create-product";

const db = new PrismaClient();

// Approximate foot length (cm) and US men's size for EU shoe sizes.
const SHOE_SIZES: Record<number, [number, string]> = {
  36: [22.5, "4.5"], 37: [23.0, "5"], 38: [24.0, "6"], 39: [24.5, "6.5"], 40: [25.0, "7"], 41: [25.5, "8"],
  42: [26.5, "9"], 43: [27.0, "10"], 44: [28.0, "10.5"], 45: [28.5, "11.5"], 46: [29.5, "12"], 47: [30.0, "13"],
};
const WATCH_SIZES = [34, 36, 38, 40, 42, 44, 46];

async function assertLocal() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: DATABASE_URL must point to a local database.");
  }
}

async function wipe() {
  await db.$executeRawUnsafe(
    `TRUNCATE "OrderNote","OrderStatusHistory","OrderItem","Order","ProductImage","ProductVariant","ProductColor","Product","Size","Brand","Category" RESTART IDENTITY CASCADE`,
  );
}

async function main() {
  await assertLocal();
  await wipe();

  // Sizes (shared list)
  const sizeId = new Map<string, string>();
  for (const [eu, [cm, us]] of Object.entries(SHOE_SIZES)) {
    const s = await db.size.create({
      data: { type: "SHOE", label: eu, position: Number(eu), footLengthCm: cm, usSize: us },
    });
    sizeId.set(`SHOE:${eu}`, s.id);
  }
  for (const mm of WATCH_SIZES) {
    const s = await db.size.create({ data: { type: "WATCH", label: `${mm}mm`, position: mm } });
    sizeId.set(`WATCH:${mm}`, s.id);
  }
  const shoe = (eu: number) => sizeId.get(`SHOE:${eu}`)!;
  const watch = (mm: number) => sizeId.get(`WATCH:${mm}`)!;

  // Categories
  const cat = async (slug: string, nameVi: string, nameEn: string, position: number, parentId?: string) =>
    db.category.create({ data: { slug, nameVi, nameEn, position, parentId } });
  const shoes = await cat("giay", "Giày", "Shoes", 1);
  const watches = await cat("dong-ho", "Đồng hồ", "Watches", 2);
  const sneaker = await cat("sneaker", "Sneaker", "Sneakers", 1, shoes.id);
  const running = await cat("giay-chay-bo", "Giày chạy bộ", "Running shoes", 2, shoes.id);
  const analog = await cat("dong-ho-co", "Đồng hồ kim", "Analog watches", 1, watches.id);
  const digital = await cat("dong-ho-dien-tu", "Đồng hồ điện tử", "Digital watches", 2, watches.id);

  // Fictional brands (not real companies). The owner adds real brands in admin.
  const brand = (slug: string, name: string, skuPrefix: string) =>
    db.brand.create({ data: { slug, name, skuPrefix } });
  const zoomer = await brand("zoomer", "Zoomer", "ZOOM");
  const stride = await brand("stride", "Stride", "STRD");
  const tide = await brand("tide", "Tide", "TIDE");
  const chrono = await brand("chrono-co", "Chrono Co", "CHRN");

  const SHOE_IMG = "/placeholders/shoe.svg";
  const WATCH_IMG = "/placeholders/watch.svg";

  // ---- Shoes: color x size variants ----
  await createProduct(db, {
    slug: "zoomer-runner-2",
    categoryId: running.id,
    brandId: zoomer.id,
    nameVi: "Giày chạy bộ Zoomer Runner 2",
    nameEn: "Zoomer Runner 2 running shoes",
    descriptionVi: "Đế êm, thân giày lưới thoáng khí, phù hợp chạy bộ hằng ngày.",
    descriptionEn: "Cushioned sole and breathable mesh upper for everyday running.",
    price: 2_390_000,
    status: "ACTIVE",
    featured: true,
    specs: [
      { key: "upper", labelVi: "Chất liệu thân", labelEn: "Upper", valueVi: "Lưới thoáng khí", valueEn: "Breathable mesh" },
      { key: "sole", labelVi: "Đế", labelEn: "Sole", valueVi: "Cao su êm", valueEn: "Cushioned rubber" },
      { key: "weight", labelVi: "Trọng lượng", labelEn: "Weight", valueVi: "280 g", valueEn: "280 g" },
    ],
    colors: [{ nameVi: "Đen", nameEn: "Black", hex: "#16140f" }, { nameVi: "Trắng", nameEn: "White", hex: "#ffffff" }],
    variants: [40, 41, 42, 43].flatMap((eu) => [
      { sku: `ZOOM-RUN2-BLK-${eu}`, color: "Đen", sizeId: shoe(eu), stock: eu === 42 ? 6 : 4 },
      { sku: `ZOOM-RUN2-WHT-${eu}`, color: "Trắng", sizeId: shoe(eu), stock: eu === 41 ? 0 : 3 },
    ]),
    images: [
      { url: SHOE_IMG, altVi: "Zoomer Runner 2", altEn: "Zoomer Runner 2" },
      { url: SHOE_IMG, altVi: "Zoomer Runner 2 màu đen", altEn: "Zoomer Runner 2 in black", color: "Đen" },
      { url: SHOE_IMG, altVi: "Zoomer Runner 2 màu trắng", altEn: "Zoomer Runner 2 in white", color: "Trắng" },
    ],
  });

  await createProduct(db, {
    slug: "zoomer-street-low",
    categoryId: sneaker.id,
    brandId: zoomer.id,
    nameVi: "Giày sneaker Zoomer Street Low",
    nameEn: "Zoomer Street Low sneakers",
    descriptionVi: "Sneaker cổ thấp phối màu tối giản, dễ phối đồ.",
    descriptionEn: "Minimal low-top sneaker that goes with everything.",
    price: 1_790_000,
    compareAtPrice: 2_090_000,
    status: "ACTIVE",
    colors: [{ nameVi: "Trắng", nameEn: "White", hex: "#ffffff" }, { nameVi: "Xám", nameEn: "Grey", hex: "#9a9a9a" }],
    variants: [39, 40, 41, 42].flatMap((eu) => [
      { sku: `ZOOM-STL-WHT-${eu}`, color: "Trắng", sizeId: shoe(eu), stock: 5 },
      { sku: `ZOOM-STL-GRY-${eu}`, color: "Xám", sizeId: shoe(eu), stock: 2 },
    ]),
    images: [
      { url: SHOE_IMG, altVi: "Zoomer Street Low", altEn: "Zoomer Street Low" },
      // One variant has its own photo (shows the variant-level photo rule).
      { url: SHOE_IMG, altVi: "Zoomer Street Low màu xám, size 41", altEn: "Zoomer Street Low in grey, size 41", variantSku: "ZOOM-STL-GRY-41" },
    ],
  });

  await createProduct(db, {
    slug: "stride-trail-pro",
    categoryId: running.id,
    brandId: stride.id,
    nameVi: "Giày chạy địa hình Stride Trail Pro",
    nameEn: "Stride Trail Pro trail shoes",
    price: 2_890_000,
    status: "ACTIVE",
    featured: true,
    colors: [{ nameVi: "Cam", nameEn: "Orange", hex: "#e8672a" }, { nameVi: "Xanh rêu", nameEn: "Olive", hex: "#6b7a3a" }],
    variants: [41, 42, 43, 44].flatMap((eu) => [
      { sku: `STRD-TRL-ORG-${eu}`, color: "Cam", sizeId: shoe(eu), stock: 3 },
      { sku: `STRD-TRL-OLV-${eu}`, color: "Xanh rêu", sizeId: shoe(eu), stock: 3 },
    ]),
    images: [{ url: SHOE_IMG, altVi: "Stride Trail Pro", altEn: "Stride Trail Pro" }],
  });

  await createProduct(db, {
    slug: "stride-classic-leather",
    categoryId: sneaker.id,
    brandId: stride.id,
    nameVi: "Giày da Stride Classic Leather",
    nameEn: "Stride Classic Leather shoes",
    price: 1_990_000,
    compareAtPrice: 2_390_000,
    status: "ACTIVE",
    colors: [{ nameVi: "Nâu", nameEn: "Brown", hex: "#7a4b2a" }],
    variants: [40, 41, 42, 43].map((eu) => ({ sku: `STRD-CLS-BRN-${eu}`, color: "Nâu", sizeId: shoe(eu), stock: 4 })),
    images: [{ url: SHOE_IMG, altVi: "Stride Classic Leather", altEn: "Stride Classic Leather" }],
  });

  // ---- Watches: color (strap/dial) x case size, plus one with no options at all ----
  await createProduct(db, {
    slug: "tide-classic-40",
    categoryId: analog.id,
    brandId: tide.id,
    nameVi: "Đồng hồ Tide Classic",
    nameEn: "Tide Classic watch",
    descriptionVi: "Đồng hồ kim phong cách cổ điển, kính sapphire chống xước.",
    descriptionEn: "Classic analog watch with scratch-resistant sapphire glass.",
    price: 4_590_000,
    status: "ACTIVE",
    featured: true,
    specs: [
      { key: "movement", labelVi: "Bộ máy", labelEn: "Movement", valueVi: "Cơ tự động", valueEn: "Automatic" },
      { key: "glass", labelVi: "Kính", labelEn: "Glass", valueVi: "Sapphire", valueEn: "Sapphire" },
      { key: "water", labelVi: "Chống nước", labelEn: "Water resistance", valueVi: "50 m", valueEn: "50 m" },
    ],
    colors: [{ nameVi: "Dây da nâu", nameEn: "Brown leather", hex: "#7a4b2a" }, { nameVi: "Dây thép", nameEn: "Steel", hex: "#b9b9b9" }],
    variants: [
      { sku: "TIDE-CLS-BRN-38", color: "Dây da nâu", sizeId: watch(38), stock: 2 },
      { sku: "TIDE-CLS-BRN-40", color: "Dây da nâu", sizeId: watch(40), stock: 3 },
      { sku: "TIDE-CLS-STL-38", color: "Dây thép", sizeId: watch(38), stock: 1, price: 4_990_000 },
      { sku: "TIDE-CLS-STL-40", color: "Dây thép", sizeId: watch(40), stock: 4, price: 4_990_000 },
    ],
    images: [{ url: WATCH_IMG, altVi: "Tide Classic", altEn: "Tide Classic" }],
  });

  await createProduct(db, {
    slug: "tide-digital-pocket",
    categoryId: digital.id,
    brandId: tide.id,
    nameVi: "Đồng hồ điện tử Tide Digital",
    nameEn: "Tide Digital watch",
    descriptionVi: "Đồng hồ điện tử nhỏ gọn, một kiểu duy nhất.",
    descriptionEn: "Compact digital watch, one version only.",
    price: 590_000,
    status: "ACTIVE",
    // No colors, no sizes: one default variant.
    defaultVariant: { sku: "TIDE-DIGI", stock: 12 },
    images: [{ url: WATCH_IMG, altVi: "Tide Digital", altEn: "Tide Digital" }],
  });

  await createProduct(db, {
    slug: "chrono-sport-44",
    categoryId: analog.id,
    brandId: chrono.id,
    nameVi: "Đồng hồ thể thao Chrono Sport",
    nameEn: "Chrono Sport watch",
    price: 3_290_000,
    status: "ACTIVE",
    colors: [{ nameVi: "Đen", nameEn: "Black", hex: "#16140f" }, { nameVi: "Xanh", nameEn: "Blue", hex: "#1f4e8c" }],
    variants: [
      { sku: "CHRN-SPT-BLK-44", color: "Đen", sizeId: watch(44), stock: 5 },
      { sku: "CHRN-SPT-BLU-44", color: "Xanh", sizeId: watch(44), stock: 3 },
    ],
    images: [{ url: WATCH_IMG, altVi: "Chrono Sport", altEn: "Chrono Sport" }],
  });

  await createProduct(db, {
    slug: "chrono-slim-38",
    categoryId: analog.id,
    brandId: chrono.id,
    nameVi: "Đồng hồ mỏng Chrono Slim",
    nameEn: "Chrono Slim watch",
    price: 2_790_000,
    status: "ACTIVE",
    colors: [{ nameVi: "Vàng hồng", nameEn: "Rose gold", hex: "#c98f7a" }, { nameVi: "Bạc", nameEn: "Silver", hex: "#c9c9c9" }],
    variants: [38, 40].flatMap((mm) => [
      { sku: `CHRN-SLM-RGD-${mm}`, color: "Vàng hồng", sizeId: watch(mm), stock: 3 },
      { sku: `CHRN-SLM-SLV-${mm}`, color: "Bạc", sizeId: watch(mm), stock: 3 },
    ]),
    images: [{ url: WATCH_IMG, altVi: "Chrono Slim", altEn: "Chrono Slim" }],
  });

  const [products, variants, sizes] = await Promise.all([db.product.count(), db.productVariant.count(), db.size.count()]);
  console.log(`Seeded ${products} products, ${variants} variants, ${sizes} sizes, 4 brands.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
