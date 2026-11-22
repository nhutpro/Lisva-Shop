import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { emptyToUndefined } from "../orders/schema";
import { SLUG_PATTERN } from "../slug";
import { failure, success, type AdminResult, type Issue } from "./errors";
import type { Translator } from "../translate/types";
import { fillCategoryEnglish } from "./auto-translate";
import { issuesFromZod } from "./zod-issues";

// Brands, categories and sizes: the lists the product editor chooses from.

const slug = z
  .string()
  .trim()
  .max(80)
  .refine((s) => SLUG_PATTERN.test(s), { message: "invalid_slug" });
const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const position = z.coerce.number().int().min(0).max(10_000).default(0);

const collides = (e: unknown, column: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  JSON.stringify(e.meta?.target ?? "").includes(column);

const invalid = (error: z.ZodError, raw: unknown) =>
  failure("INVALID_INPUT", { issues: issuesFromZod(error, raw) });
const conflict = (issues: Issue[]) => failure("CONFLICT", { issues });

// ---------- Brands ----------

export type BrandRow = {
  id: string;
  slug: string;
  name: string;
  skuPrefix: string;
  productCount: number;
};

const brandSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug,
  skuPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, { message: "invalid_sku" }),
});

const brandRow = (b: {
  id: string;
  slug: string;
  name: string;
  skuPrefix: string;
  _count: { products: number };
}): BrandRow => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  skuPrefix: b.skuPrefix,
  productCount: b._count.products,
});

export async function listBrands(db: PrismaClient): Promise<BrandRow[]> {
  const rows = await db.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map(brandRow);
}

export async function saveBrand(
  db: PrismaClient,
  raw: Record<string, unknown>,
  id?: string,
): Promise<AdminResult<BrandRow>> {
  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error, raw);
  try {
    const include = { _count: { select: { products: true } } } as const;
    if (
      id &&
      !(await db.brand.findUnique({ where: { id }, select: { id: true } }))
    )
      return failure("NOT_FOUND");
    const row = id
      ? await db.brand.update({ where: { id }, data: parsed.data, include })
      : await db.brand.create({ data: parsed.data, include });
    return success(brandRow(row));
  } catch (e) {
    if (collides(e, "slug"))
      return conflict([{ path: "slug", code: "slug_taken" }]);
    if (collides(e, "skuPrefix"))
      return conflict([{ path: "skuPrefix", code: "prefix_taken" }]);
    throw e;
  }
}

export async function deleteBrand(
  db: PrismaClient,
  id: string,
): Promise<AdminResult<true>> {
  const brand = await db.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!brand) return failure("NOT_FOUND");
  if (brand._count.products > 0)
    return failure("IN_USE", { usedBy: brand._count.products });
  await db.brand.delete({ where: { id } });
  return success(true);
}

// ---------- Categories ----------

export type CategoryRow = {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string | null;
  parentId: string | null;
  position: number;
  productCount: number;
  childCount: number;
};

const categorySchema = z.object({
  nameVi: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  slug,
  parentId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  position,
});

const categoryInclude = {
  _count: { select: { products: true, children: true } },
} as const;
const categoryRow = (c: {
  id: string;
  slug: string;
  nameVi: string;
  nameEn: string | null;
  parentId: string | null;
  position: number;
  _count: { products: number; children: number };
}): CategoryRow => ({
  id: c.id,
  slug: c.slug,
  nameVi: c.nameVi,
  nameEn: c.nameEn,
  parentId: c.parentId,
  position: c.position,
  productCount: c._count.products,
  childCount: c._count.children,
});

export async function listCategories(db: PrismaClient): Promise<CategoryRow[]> {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { nameVi: "asc" }],
    include: categoryInclude,
  });
  return rows.map(categoryRow);
}

export async function saveCategory(
  db: PrismaClient,
  input: Record<string, unknown>,
  id?: string,
  translate?: Translator,
): Promise<AdminResult<CategoryRow>> {
  const raw = await fillCategoryEnglish(input, translate);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error, raw);
  const { parentId, ...data } = parsed.data;

  const current = id
    ? await db.category.findUnique({
        where: { id },
        include: { _count: { select: { children: true } } },
      })
    : null;
  if (id && !current) return failure("NOT_FOUND");

  if (parentId) {
    // Two levels only: a category can sit under a top-level one, and a parent cannot itself have a parent.
    const parent = await db.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent)
      return failure("INVALID_INPUT", {
        issues: [{ path: "parentId", code: "not_found" }],
      });
    if (
      parent.id === id ||
      parent.parentId !== null ||
      (current && current._count.children > 0)
    ) {
      return failure("INVALID_INPUT", {
        issues: [{ path: "parentId", code: "invalid" }],
      });
    }
  }

  try {
    // Emptied optional fields must become null: Prisma ignores `undefined` on update, so the old value would stay.
    const value = { ...data, parentId: parentId ?? null };
    const row = id
      ? await db.category.update({
          where: { id },
          data: value,
          include: categoryInclude,
        })
      : await db.category.create({ data: value, include: categoryInclude });
    return success(categoryRow(row));
  } catch (e) {
    if (collides(e, "slug"))
      return conflict([{ path: "slug", code: "slug_taken" }]);
    throw e;
  }
}

export async function deleteCategory(
  db: PrismaClient,
  id: string,
): Promise<AdminResult<true>> {
  const category = await db.category.findUnique({
    where: { id },
    include: categoryInclude,
  });
  if (!category) return failure("NOT_FOUND");
  const used = category._count.products + category._count.children;
  if (used > 0) return failure("IN_USE", { usedBy: used });
  await db.category.delete({ where: { id } });
  return success(true);
}

// ---------- Sizes ----------

export type SizeRow = {
  id: string;
  type: "SHOE" | "WATCH";
  label: string;
  position: number;
  footLengthCm: number | null;
  usSize: string | null;
  variantCount: number;
};

const sizeSchema = z.object({
  type: z.enum(["SHOE", "WATCH"]),
  label: z.string().trim().min(1).max(12),
  position,
  footLengthCm: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(10).max(40).optional(),
  ),
  usSize: optionalText(8),
});

const sizeRow = (s: {
  id: string;
  type: "SHOE" | "WATCH";
  label: string;
  position: number;
  footLengthCm: Prisma.Decimal | null;
  usSize: string | null;
  _count: { variants: number };
}): SizeRow => ({
  id: s.id,
  type: s.type,
  label: s.label,
  position: s.position,
  footLengthCm: s.footLengthCm === null ? null : Number(s.footLengthCm),
  usSize: s.usSize,
  variantCount: s._count.variants,
});

export async function listSizes(db: PrismaClient): Promise<SizeRow[]> {
  const rows = await db.size.findMany({
    orderBy: [{ type: "asc" }, { position: "asc" }],
    include: { _count: { select: { variants: true } } },
  });
  return rows.map(sizeRow);
}

export async function saveSize(
  db: PrismaClient,
  raw: Record<string, unknown>,
  id?: string,
): Promise<AdminResult<SizeRow>> {
  const parsed = sizeSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error, raw);
  const data = {
    ...parsed.data,
    footLengthCm: parsed.data.footLengthCm ?? null,
    usSize: parsed.data.usSize ?? null,
  };
  try {
    const include = { _count: { select: { variants: true } } } as const;
    if (
      id &&
      !(await db.size.findUnique({ where: { id }, select: { id: true } }))
    )
      return failure("NOT_FOUND");
    const row = id
      ? await db.size.update({ where: { id }, data, include })
      : await db.size.create({ data, include });
    return success(sizeRow(row));
  } catch (e) {
    if (collides(e, "label"))
      return conflict([{ path: "label", code: "label_taken" }]);
    throw e;
  }
}

export async function deleteSize(
  db: PrismaClient,
  id: string,
): Promise<AdminResult<true>> {
  const size = await db.size.findUnique({
    where: { id },
    include: { _count: { select: { variants: true } } },
  });
  if (!size) return failure("NOT_FOUND");
  if (size._count.variants > 0)
    return failure("IN_USE", { usedBy: size._count.variants });
  await db.size.delete({ where: { id } });
  return success(true);
}
