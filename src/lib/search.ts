/** Lowercase, strip Vietnamese diacritics, "đ" -> "d", collapse spaces. "Giày Đen" -> "giay den". */
export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Value stored in Product.searchText. */
export function buildSearchText(...parts: Array<string | null | undefined>): string {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}
