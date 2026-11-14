import type { PrismaClient } from "@prisma/client";
import { normalizeSearch } from "../search";

/** Active products matching every word of the query, ignoring case and diacritics. */
export async function searchProducts(db: PrismaClient, query: string, limit = 24) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];

  return db.product.findMany({
    where: {
      status: "ACTIVE",
      AND: words.map((word) => ({ searchText: { contains: word } })),
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}
