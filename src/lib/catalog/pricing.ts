/** A variant's own price wins; otherwise the product price. Whole VND. */
export function effectivePrice(
  product: { price: number },
  variant: { price: number | null },
): number {
  return variant.price ?? product.price;
}

type ImageLike = { variantId: string | null; colorId: string | null; position: number };

/**
 * Photos to show for a chosen variant: its own photos first, else its color's photos,
 * else the product's general photos. Each group sorted by position.
 */
export function pickImages<T extends ImageLike>(
  images: T[],
  variant: { id: string; colorId: string | null },
): T[] {
  const byPosition = (a: T, b: T) => a.position - b.position;
  const own = images.filter((i) => i.variantId === variant.id).sort(byPosition);
  if (own.length) return own;
  if (variant.colorId) {
    const color = images.filter((i) => i.colorId === variant.colorId).sort(byPosition);
    if (color.length) return color;
  }
  return images.filter((i) => !i.variantId && !i.colorId).sort(byPosition);
}
