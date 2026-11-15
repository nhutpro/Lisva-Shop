import type { PrismaClient } from "@prisma/client";
import { effectivePrice, pickImages } from "./pricing";

export const MAX_CART_LINES = 30;

/** Current shop data for one variant in the cart. Plain data, safe to send to the browser. */
export type CartLineData = {
  variantId: string;
  productSlug: string;
  nameVi: string;
  nameEn: string | null;
  brandName: string;
  colorNameVi: string | null;
  colorNameEn: string | null;
  sizeLabel: string | null;
  sku: string;
  unitPrice: number;
  stock: number;
  /** False when the variant is switched off or the product is hidden: it cannot be ordered. */
  available: boolean;
  image: { url: string; altVi: string | null; altEn: string | null } | null;
};

/**
 * Looks up the variants in a cart. Variants that no longer exist are simply missing from the result,
 * and the result follows the order of `variantIds`. The browser only stores ids and quantities; names,
 * prices and stock always come from here.
 */
export async function getCartLines(db: PrismaClient, variantIds: string[]): Promise<CartLineData[]> {
  const ids = [...new Set(variantIds)].slice(0, MAX_CART_LINES);
  if (ids.length === 0) return [];

  const variants = await db.productVariant.findMany({
    where: { id: { in: ids } },
    include: {
      product: { include: { brand: { select: { name: true } }, images: true } },
      color: { select: { nameVi: true, nameEn: true } },
      size: { select: { label: true } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  return ids.flatMap((id) => {
    const v = byId.get(id);
    if (!v) return [];
    const image = pickImages(v.product.images, v)[0];
    return [
      {
        variantId: v.id,
        productSlug: v.product.slug,
        nameVi: v.product.nameVi,
        nameEn: v.product.nameEn,
        brandName: v.product.brand.name,
        colorNameVi: v.color?.nameVi ?? null,
        colorNameEn: v.color?.nameEn ?? null,
        sizeLabel: v.size?.label ?? null,
        sku: v.sku,
        unitPrice: effectivePrice(v.product, v),
        stock: v.stock,
        available: v.isActive && v.product.status === "ACTIVE",
        image: image ? { url: image.url, altVi: image.altVi, altEn: image.altEn } : null,
      },
    ];
  });
}
