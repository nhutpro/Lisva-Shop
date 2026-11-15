"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_CART_LINES, getCartLines, type CartLineData } from "@/lib/catalog/cart-lines";

const idsSchema = z.array(z.string().min(1).max(64)).max(MAX_CART_LINES);

/**
 * Current names, prices and stock for the variants in a browser's cart (read only, no personal data).
 * Anything that is not a plain list of ids is treated as an empty cart.
 */
export async function loadCartLines(variantIds: string[]): Promise<CartLineData[]> {
  const ids = idsSchema.safeParse(variantIds);
  return ids.success ? getCartLines(db, ids.data) : [];
}
