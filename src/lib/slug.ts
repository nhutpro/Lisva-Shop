import { normalizeSearch } from "./search";

/** "Giày chạy bộ Zoomer 2" -> "giay-chay-bo-zoomer-2". Used to suggest URLs and codes from names. */
export function slugify(text: string, maxLength = 80): string {
  return normalizeSearch(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
