import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeSearch } from "../search";
import { effectivePrice } from "./pricing";
import { PAGE_SIZE, type ListParams } from "./parse-list-params";
import { specsSchema } from "./specs";
import type {
  CategoryData,
  HomeData,
  ListFacets,
  ListResult,
  ProductCardData,
  ProductDetailData,
} from "./types";

// Plain database queries returning serializable data. Cached wrappers live in queries.ts.

const cardInclude = {
  brand: { select: { name: true } },
  category: { select: { slug: true } },
  colors: { orderBy: { position: "asc" }, select: { nameVi: true, nameEn: true, hex: true } },
  variants: { where: { isActive: true }, select: { price: true, stock: true } },
  images: {
    where: { variantId: null, colorId: null },
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, altVi: true, altEn: true },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(p: CardRow): ProductCardData {
  const prices = p.variants.map((v) => effectivePrice(p, v));
  const fromPrice = prices.length ? Math.min(...prices) : p.price;
  return {
    id: p.id,
    slug: p.slug,
    nameVi: p.nameVi,
    nameEn: p.nameEn,
    brandName: p.brand.name,
    categorySlug: p.category.slug,
    fromPrice,
    priceVaries: new Set(prices).size > 1,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0] ?? null,
    colors: p.colors,
    inStock: p.variants.some((v) => v.stock > 0),
  };
}

/** A category slug matches the category itself and its direct children. */
const inCategory = (slug: string): Prisma.ProductWhereInput => ({
  category: { OR: [{ slug }, { parent: { slug } }] },
});

function buildWhere(params: ListParams): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  for (const word of normalizeSearch(params.q).split(" ").filter(Boolean)) {
    and.push({ searchText: { contains: word } });
  }
  if (params.category) and.push(inCategory(params.category));
  if (params.brands.length) and.push({ brand: { slug: { in: params.brands } } });
  if (params.minPrice !== undefined) and.push({ price: { gte: params.minPrice } });
  if (params.maxPrice !== undefined) and.push({ price: { lte: params.maxPrice } });
  if (params.sizes.length) {
    and.push({ variants: { some: { isActive: true, size: { label: { in: params.sizes } } } } });
  }
  if (params.colors.length) and.push({ colors: { some: { nameVi: { in: params.colors } } } });

  return { status: "ACTIVE", AND: and };
}

const orderBy = (sort: ListParams["sort"]): Prisma.ProductOrderByWithRelationInput[] =>
  sort === "price-asc"
    ? [{ price: "asc" }, { id: "asc" }]
    : sort === "price-desc"
      ? [{ price: "desc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "asc" }];

export async function listProducts(db: PrismaClient, params: ListParams): Promise<ListResult> {
  const where = buildWhere(params);
  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // A page beyond the last one shows the last page instead of an empty list.
  const page = Math.min(params.page, pageCount);

  const rows = await db.product.findMany({
    where,
    orderBy: orderBy(params.sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: cardInclude,
  });
  return { items: rows.map(toCard), total, page, pageCount };
}

/** Filter options for the current category (all active products when none). */
export async function getListFacets(db: PrismaClient, category?: string): Promise<ListFacets> {
  const scope: Prisma.ProductWhereInput = { status: "ACTIVE", ...(category ? inCategory(category) : {}) };

  const [brands, sizes, colors, price] = await Promise.all([
    db.brand.findMany({
      where: { products: { some: scope } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    db.size.findMany({
      where: { variants: { some: { isActive: true, product: scope } } },
      orderBy: [{ type: "asc" }, { position: "asc" }],
      select: { label: true, type: true },
    }),
    db.productColor.findMany({
      where: { product: scope },
      distinct: ["nameVi"],
      orderBy: { nameVi: "asc" },
      select: { nameVi: true, nameEn: true, hex: true },
    }),
    db.product.aggregate({ where: scope, _min: { price: true }, _max: { price: true } }),
  ]);

  return { brands, sizes, colors, priceMin: price._min.price, priceMax: price._max.price };
}

export async function getCategories(db: PrismaClient): Promise<CategoryData[]> {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { nameVi: "asc" }],
    include: { parent: { select: { slug: true } } },
  });
  return Promise.all(
    rows.map(async (c) => ({
      slug: c.slug,
      nameVi: c.nameVi,
      nameEn: c.nameEn,
      parentSlug: c.parent?.slug ?? null,
      count: await db.product.count({ where: { status: "ACTIVE", ...inCategory(c.slug) } }),
    })),
  );
}

export async function getProductDetail(db: PrismaClient, slug: string): Promise<ProductDetailData | null> {
  const p = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      brand: { select: { name: true } },
      category: { select: { slug: true, nameVi: true, nameEn: true } },
      colors: { orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: { position: "asc" }, include: { size: true } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!p) return null;

  const sizes = new Map<string, ProductDetailData["sizes"][number]>();
  for (const v of p.variants) {
    if (v.size && !sizes.has(v.size.id)) {
      sizes.set(v.size.id, {
        id: v.size.id,
        label: v.size.label,
        type: v.size.type,
        footLengthCm: v.size.footLengthCm === null ? null : Number(v.size.footLengthCm),
        usSize: v.size.usSize,
      });
    }
  }

  const parsedSpecs = specsSchema.safeParse(p.specs);

  return {
    id: p.id,
    slug: p.slug,
    nameVi: p.nameVi,
    nameEn: p.nameEn,
    descriptionVi: p.descriptionVi,
    descriptionEn: p.descriptionEn,
    brandName: p.brand.name,
    category: p.category,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    specs: parsedSpecs.success ? parsedSpecs.data : [],
    colors: p.colors.map((c) => ({ id: c.id, nameVi: c.nameVi, nameEn: c.nameEn, hex: c.hex })),
    sizes: [...sizes.values()].sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorId: v.colorId,
      sizeId: v.sizeId,
      price: effectivePrice(p, v),
      stock: v.stock,
    })),
    images: p.images.map((i) => ({
      id: i.id,
      url: i.url,
      altVi: i.altVi,
      altEn: i.altEn,
      variantId: i.variantId,
      colorId: i.colorId,
      position: i.position,
    })),
  };
}

export async function getHomeData(db: PrismaClient): Promise<HomeData> {
  const [featured, newest, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", featured: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 4,
      include: cardInclude,
    }),
    db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 8,
      include: cardInclude,
    }),
    getCategories(db),
  ]);
  return { featured: featured.map(toCard), newest: newest.map(toCard), categories };
}

/** Slugs of every active product, for the sitemap. */
export async function getProductSlugs(db: PrismaClient): Promise<{ slug: string; updatedAt: Date }[]> {
  return db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } });
}
