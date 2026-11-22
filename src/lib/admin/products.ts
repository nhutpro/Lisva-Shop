import { Prisma, type PrismaClient, type ProductStatus } from "@prisma/client";
import { buildSearchText, normalizeSearch } from "../search";
import { slugify } from "../slug";
import {
  failure,
  success,
  type AdminErrorCode,
  type AdminResult,
  type Issue,
} from "./errors";
import { LOW_STOCK_LIMIT } from "./orders";
import { productFormSchema, type ProductEditorData } from "./product-schema";
import type { Translator } from "../translate/types";
import { fillEnglish } from "./auto-translate";
import { issuesFromZod } from "./zod-issues";

export const ADMIN_PRODUCTS_PER_PAGE = 20;

/** Thrown inside the transaction to roll everything back and report a problem. */
class Abort extends Error {
  constructor(readonly result: ReturnType<typeof failure>) {
    super("abort");
  }
}
const abort = (code: AdminErrorCode, issues?: Issue[]): never => {
  throw new Abort(failure(code, { issues }));
};

const isUnique = (e: unknown, part: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  JSON.stringify(e.meta?.target ?? "").includes(part);

/**
 * Creates or updates a product with its colors, variants and photos in one transaction (all or nothing).
 * Existing colors and variants are matched by id (their `key`); a missing one is deleted, a new one is created.
 * Old orders keep their own copy of the items, so deleting a variant never breaks them.
 */
export async function saveProduct(
  db: PrismaClient,
  input: unknown,
  /** Optional: fills English fields left empty from the Vietnamese text before validation. */
  translate?: Translator,
): Promise<AdminResult<{ id: string; slug: string }>> {
  const raw = await fillEnglish(input, translate); // before the transaction: a slow call must not hold it open
  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success)
    return failure("INVALID_INPUT", {
      issues: issuesFromZod(parsed.error, raw),
    });
  const p = parsed.data;

  try {
    const saved = await db.$transaction(
      async (tx) => {
        const existing = p.id
          ? await tx.product.findUnique({ where: { id: p.id } })
          : null;
        if (p.id && !existing) abort("NOT_FOUND");

        const [category, brand] = await Promise.all([
          tx.category.findUnique({ where: { id: p.categoryId } }),
          tx.brand.findUnique({ where: { id: p.brandId } }),
        ]);
        const problems: Issue[] = [];
        if (!category) problems.push({ path: "categoryId", code: "not_found" });
        if (!brand) problems.push({ path: "brandId", code: "not_found" });

        const sizeIds = [
          ...new Set(p.variants.flatMap((v) => (v.sizeId ? [v.sizeId] : []))),
        ];
        const knownSizes = new Set(
          (sizeIds.length
            ? await tx.size.findMany({
                where: { id: { in: sizeIds } },
                select: { id: true },
              })
            : []
          ).map((s) => s.id),
        );
        p.variants.forEach((v, i) => {
          if (v.sizeId && !knownSizes.has(v.sizeId))
            problems.push({
              path: `variants.${i}.sizeId`,
              code: "unknown_size",
            });
        });
        if (problems.length) abort("INVALID_INPUT", problems);

        // Things that must be unique across the shop, reported next to the field.
        const conflicts: Issue[] = [];
        const slugOwner = await tx.product.findUnique({
          where: { slug: p.slug },
          select: { id: true },
        });
        if (slugOwner && slugOwner.id !== p.id)
          conflicts.push({ path: "slug", code: "slug_taken" });
        const taken = new Set(
          (
            await tx.productVariant.findMany({
              where: {
                sku: { in: p.variants.map((v) => v.sku) },
                ...(p.id ? { productId: { not: p.id } } : {}),
              },
              select: { sku: true },
            })
          ).map((v) => v.sku),
        );
        p.variants.forEach(
          (v, i) =>
            taken.has(v.sku) &&
            conflicts.push({ path: `variants.${i}.sku`, code: "sku_taken" }),
        );
        if (conflicts.length) abort("CONFLICT", conflicts);

        const specs = p.specs.map((s, i) => ({
          key: slugify(s.labelVi) || `spec-${i + 1}`,
          labelVi: s.labelVi,
          ...(s.labelEn ? { labelEn: s.labelEn } : {}),
          valueVi: s.valueVi,
          ...(s.valueEn ? { valueEn: s.valueEn } : {}),
        }));
        const data = {
          slug: p.slug,
          categoryId: p.categoryId,
          brandId: p.brandId,
          nameVi: p.nameVi,
          nameEn: p.nameEn ?? null,
          descriptionVi: p.descriptionVi ?? null,
          descriptionEn: p.descriptionEn ?? null,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          status: p.status,
          featured: p.featured,
          specs: specs as Prisma.InputJsonValue,
          searchText: buildSearchText(
            p.nameVi,
            p.nameEn,
            brand!.name,
            category!.nameVi,
          ),
          publishedAt:
            existing?.publishedAt ??
            (p.status === "ACTIVE" ? new Date() : null),
        };
        const product = existing
          ? await tx.product.update({ where: { id: existing.id }, data })
          : await tx.product.create({ data });
        const productId = product.id;

        // ----- colors: (productId, name) is unique, so names that are being swapped get a temporary name first
        const existingColors = new Map(
          (await tx.productColor.findMany({ where: { productId } })).map(
            (c) => [c.id, c],
          ),
        );
        for (const c of p.colors) {
          const old = existingColors.get(c.key);
          if (old && old.nameVi !== c.nameVi)
            await tx.productColor.update({
              where: { id: old.id },
              data: { nameVi: `~${old.id}` },
            });
        }
        const colorIds = new Map<string, string>();
        for (const [i, c] of p.colors.entries()) {
          const value = {
            nameVi: c.nameVi,
            nameEn: c.nameEn ?? null,
            hex: c.hex ?? null,
            position: i,
          };
          const old = existingColors.get(c.key);
          const row = old
            ? await tx.productColor.update({
                where: { id: old.id },
                data: value,
              })
            : await tx.productColor.create({ data: { ...value, productId } });
          colorIds.set(c.key, row.id);
        }

        // ----- variants: remove the ones that are gone first, then update and create the rest
        const existingVariants = new Map(
          (
            await tx.productVariant.findMany({
              where: { productId },
              select: { id: true, sku: true },
            })
          ).map((v) => [v.id, v]),
        );
        const kept = p.variants
          .filter((v) => existingVariants.has(v.key))
          .map((v) => v.key);
        await tx.productVariant.deleteMany({
          where: { productId, id: { notIn: kept } },
        });
        for (const v of p.variants) {
          const old = existingVariants.get(v.key);
          if (old && old.sku !== v.sku)
            await tx.productVariant.update({
              where: { id: old.id },
              data: { sku: `~${old.id}` },
            });
        }
        const variantIds = new Map<string, string>();
        for (const [i, v] of p.variants.entries()) {
          const value = {
            colorId: v.colorKey ? (colorIds.get(v.colorKey) ?? null) : null,
            sizeId: v.sizeId ?? null,
            sku: v.sku,
            price: v.price ?? null,
            stock: v.stock,
            isActive: v.isActive,
            position: i,
          };
          const old = existingVariants.get(v.key);
          const row = old
            ? await tx.productVariant.update({
                where: { id: old.id },
                data: value,
              })
            : await tx.productVariant.create({ data: { ...value, productId } });
          variantIds.set(v.key, row.id);
        }

        await tx.productColor.deleteMany({
          where: { productId, id: { notIn: [...colorIds.values()] } },
        });

        // ----- photos: replaced as a whole, in the order given
        await tx.productImage.deleteMany({ where: { productId } });
        if (p.images.length) {
          await tx.productImage.createMany({
            data: p.images.map((img, i) => ({
              productId,
              url: img.url,
              altVi: img.altVi ?? null,
              altEn: img.altEn ?? null,
              colorId: img.colorKey
                ? (colorIds.get(img.colorKey) ?? null)
                : null,
              variantId: img.variantKey
                ? (variantIds.get(img.variantKey) ?? null)
                : null,
              position: i,
            })),
          });
        }
        return { id: productId, slug: product.slug };
      },
      { timeout: 30_000 },
    );
    return success(saved);
  } catch (e) {
    if (e instanceof Abort) return e.result;
    // A race with another save, or a combination the checks above could not see.
    if (isUnique(e, "slug"))
      return failure("CONFLICT", {
        issues: [{ path: "slug", code: "slug_taken" }],
      });
    if (isUnique(e, "sku"))
      return failure("CONFLICT", {
        issues: [{ path: "variants", code: "sku_taken" }],
      });
    if (isUnique(e, "color_size"))
      return failure("CONFLICT", {
        issues: [{ path: "variants", code: "duplicate_variant" }],
      });
    throw e;
  }
}

/** A product can be deleted only when no order refers to it; otherwise archive it. */
export async function deleteProduct(
  db: PrismaClient,
  id: string,
): Promise<AdminResult<true>> {
  const product = await db.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!product) return failure("NOT_FOUND");
  const orderLines = await db.orderItem.count({
    where: { variant: { productId: id } },
  });
  if (orderLines > 0) return failure("IN_USE", { usedBy: orderLines });
  await db.product.delete({ where: { id } });
  return success(true);
}

/** The product in the shape the editor works with, or null. */
export async function getAdminProduct(
  db: PrismaClient,
  id: string,
): Promise<ProductEditorData | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: {
      colors: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!p) return null;

  const specs = Array.isArray(p.specs)
    ? (p.specs as Record<string, unknown>[])
    : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: p.id,
    slug: p.slug,
    categoryId: p.categoryId,
    brandId: p.brandId,
    nameVi: p.nameVi,
    nameEn: p.nameEn ?? "",
    descriptionVi: p.descriptionVi ?? "",
    descriptionEn: p.descriptionEn ?? "",
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    status: p.status,
    featured: p.featured,
    specs: specs.map((s) => ({
      labelVi: str(s.labelVi),
      labelEn: str(s.labelEn),
      valueVi: str(s.valueVi),
      valueEn: str(s.valueEn),
    })),
    colors: p.colors.map((c) => ({
      key: c.id,
      nameVi: c.nameVi,
      nameEn: c.nameEn ?? "",
      hex: c.hex ?? "",
    })),
    variants: p.variants.map((v) => ({
      key: v.id,
      colorKey: v.colorId,
      sizeId: v.sizeId,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      isActive: v.isActive,
    })),
    images: p.images.map((i) => ({
      url: i.url,
      altVi: i.altVi ?? "",
      altEn: i.altEn ?? "",
      colorKey: i.colorId,
      variantKey: i.variantId,
    })),
  };
}

export type AdminProductFilters = {
  q?: string;
  status?: ProductStatus;
  categoryId?: string;
  page?: number;
};

export type AdminProductRow = {
  id: string;
  slug: string;
  nameVi: string;
  brandName: string;
  categoryName: string;
  price: number;
  status: ProductStatus;
  featured: boolean;
  variantCount: number;
  totalStock: number;
  lowStock: boolean;
  image: string | null;
  updatedAt: string;
};

export type AdminProductList = {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listAdminProducts(
  db: PrismaClient,
  filters: AdminProductFilters = {},
): Promise<AdminProductList> {
  const and: Prisma.ProductWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.categoryId)
    and.push({
      OR: [
        { categoryId: filters.categoryId },
        { category: { parentId: filters.categoryId } },
      ],
    });

  const text = filters.q?.trim();
  if (text) {
    const words = normalizeSearch(text).split(" ").filter(Boolean);
    and.push({
      OR: [
        { AND: words.map((w) => ({ searchText: { contains: w } })) },
        { slug: { contains: text.toLowerCase() } },
        { variants: { some: { sku: { contains: text.toUpperCase() } } } },
      ],
    });
  }
  const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};

  const total = await db.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PER_PAGE));
  const page = Math.min(
    Math.max(1, Math.trunc(filters.page ?? 1) || 1),
    pageCount,
  );

  const rows = await db.product.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PRODUCTS_PER_PAGE,
    take: ADMIN_PRODUCTS_PER_PAGE,
    include: {
      brand: { select: { name: true } },
      category: { select: { nameVi: true } },
      variants: { select: { stock: true, isActive: true } },
      images: {
        where: { variantId: null, colorId: null },
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  return {
    items: rows.map((p) => {
      const active = p.variants.filter((v) => v.isActive);
      return {
        id: p.id,
        slug: p.slug,
        nameVi: p.nameVi,
        brandName: p.brand.name,
        categoryName: p.category.nameVi,
        price: p.price,
        status: p.status,
        featured: p.featured,
        variantCount: p.variants.length,
        totalStock: active.reduce((sum, v) => sum + v.stock, 0),
        lowStock:
          p.status === "ACTIVE" &&
          active.some((v) => v.stock <= LOW_STOCK_LIMIT),
        image: p.images[0]?.url ?? null,
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
    total,
    page,
    pageCount,
  };
}
