import type { PrismaClient, ProductStatus } from "@prisma/client";
import { buildSearchText } from "../search";
import { specsSchema } from "./specs";

export type ProductInput = {
  slug: string;
  categoryId: string;
  brandId: string;
  nameVi: string;
  nameEn?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  /** Whole VND. */
  price: number;
  compareAtPrice?: number;
  status?: ProductStatus;
  specs?: unknown;
  featured?: boolean;
  colors?: { nameVi: string; nameEn?: string; hex?: string }[];
  /** Color is referenced by its nameVi. Leave empty for a product without options. */
  variants?: { sku: string; color?: string; sizeId?: string; price?: number; stock?: number }[];
  /** Used only when `variants` is empty: the single default variant of an option-less product. */
  defaultVariant?: { sku: string; stock?: number };
  /** Attach to a color (by nameVi) or to a variant (by sku), never both. Neither = general photo. */
  images?: { url: string; altVi?: string; altEn?: string; color?: string; variantSku?: string }[];
};

/** Creates a product with its colors, variants and photos. Every product ends up with at least one variant. */
export async function createProduct(db: PrismaClient, input: ProductInput) {
  const variants = input.variants?.length
    ? input.variants
    : input.defaultVariant
      ? [{ ...input.defaultVariant }]
      : null;
  if (!variants) {
    throw new Error("A product needs variants, or a defaultVariant when it has no options.");
  }
  const specs = specsSchema.parse(input.specs ?? []);

  return db.$transaction(async (tx) => {
    const [category, brand] = await Promise.all([
      tx.category.findUniqueOrThrow({ where: { id: input.categoryId } }),
      tx.brand.findUniqueOrThrow({ where: { id: input.brandId } }),
    ]);

    const product = await tx.product.create({
      data: {
        slug: input.slug,
        categoryId: input.categoryId,
        brandId: input.brandId,
        nameVi: input.nameVi,
        nameEn: input.nameEn,
        descriptionVi: input.descriptionVi,
        descriptionEn: input.descriptionEn,
        price: input.price,
        compareAtPrice: input.compareAtPrice,
        status: input.status ?? "DRAFT",
        specs,
        featured: input.featured ?? false,
        publishedAt: input.status === "ACTIVE" ? new Date() : null,
        searchText: buildSearchText(input.nameVi, input.nameEn, brand.name, category.nameVi),
      },
    });

    const colorIds = new Map<string, string>();
    for (const [position, color] of (input.colors ?? []).entries()) {
      const created = await tx.productColor.create({
        data: { productId: product.id, position, ...color },
      });
      colorIds.set(color.nameVi, created.id);
    }
    const colorId = (name: string | undefined) => {
      if (name === undefined) return null;
      const id = colorIds.get(name);
      if (!id) throw new Error(`Unknown color "${name}" for product ${input.slug}`);
      return id;
    };

    const variantIds = new Map<string, string>();
    for (const [position, v] of variants.entries()) {
      const created = await tx.productVariant.create({
        data: {
          productId: product.id,
          colorId: colorId("color" in v ? v.color : undefined),
          sizeId: "sizeId" in v ? (v.sizeId ?? null) : null,
          sku: v.sku,
          price: "price" in v ? v.price : undefined,
          stock: v.stock ?? 0,
          position,
        },
      });
      variantIds.set(v.sku, created.id);
    }

    for (const [position, image] of (input.images ?? []).entries()) {
      if (image.color !== undefined && image.variantSku !== undefined) {
        throw new Error("An image can belong to a color or a variant, not both.");
      }
      let variantId: string | null = null;
      if (image.variantSku !== undefined) {
        variantId = variantIds.get(image.variantSku) ?? null;
        if (!variantId) throw new Error(`Unknown variant sku "${image.variantSku}"`);
      }
      await tx.productImage.create({
        data: {
          productId: product.id,
          variantId,
          colorId: colorId(image.color),
          url: image.url,
          altVi: image.altVi,
          altEn: image.altEn,
          position,
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { variants: true, colors: true, images: true },
    });
  });
}
