import { describe, expect, it } from "vitest";
import { hasActiveFilters, listParamsToSearch, parseListParams } from "./parse-list-params";

describe("parseListParams", () => {
  it("returns safe defaults for an empty query", () => {
    expect(parseListParams({})).toEqual({
      q: "",
      category: undefined,
      brands: [],
      sizes: [],
      colors: [],
      minPrice: undefined,
      maxPrice: undefined,
      sort: "new",
      page: 1,
    });
  });

  it("reads filters, repeated values and sort", () => {
    const p = parseListParams({
      q: "  giày  ",
      category: "giay-chay-bo".replace("à", "a"),
      brand: ["zoomer", "stride"],
      size: "42",
      color: ["Đen", "Trắng"],
      minPrice: "1000000",
      maxPrice: "3000000",
      sort: "price-asc",
      page: "3",
    });
    expect(p).toMatchObject({
      q: "giày",
      category: "giay-chay-bo",
      brands: ["zoomer", "stride"],
      sizes: ["42"],
      colors: ["Đen", "Trắng"],
      minPrice: 1_000_000,
      maxPrice: 3_000_000,
      sort: "price-asc",
      page: 3,
    });
  });

  it("falls back on invalid values instead of throwing", () => {
    const p = parseListParams({
      page: "-5",
      sort: "drop table",
      minPrice: "abc",
      maxPrice: "99999999999999",
      category: "../etc/passwd",
      brand: ["OK-slug", "valid-one", "<script>"],
      size: "x".repeat(50),
    });
    expect(p).toMatchObject({ page: 1, sort: "new", minPrice: undefined, maxPrice: undefined, category: undefined });
    expect(p.brands).toEqual(["valid-one"]);
    expect(p.sizes).toEqual([]);
  });

  it("clamps the page, trims the query and swaps a reversed price range", () => {
    expect(parseListParams({ page: "99999" }).page).toBe(1);
    expect(parseListParams({ page: "5000" }).page).toBe(1000);
    expect(parseListParams({ q: "a".repeat(200) }).q).toHaveLength(80);
    const swapped = parseListParams({ minPrice: "500", maxPrice: "100" });
    expect([swapped.minPrice, swapped.maxPrice]).toEqual([100, 500]);
  });

  it("limits and de-duplicates list values", () => {
    const p = parseListParams({ brand: Array.from({ length: 30 }, (_, i) => `b${i}`).concat("b1") });
    expect(p.brands).toHaveLength(10);
    expect(new Set(p.brands).size).toBe(10);
  });
});

describe("listParamsToSearch", () => {
  it("omits defaults and round-trips", () => {
    const params = parseListParams({ q: "giay", brand: ["zoomer"], sort: "price-desc", page: "2" });
    const search = listParamsToSearch(params);
    expect(search).toBe("?q=giay&brand=zoomer&sort=price-desc&page=2");
    const back = Object.fromEntries(new URLSearchParams(search));
    expect(parseListParams(back)).toEqual(params);
  });

  it("returns an empty string with nothing set and supports overrides", () => {
    const params = parseListParams({});
    expect(listParamsToSearch(params)).toBe("");
    expect(listParamsToSearch(params, { page: 2, sort: "price-asc" })).toBe("?sort=price-asc&page=2");
  });
});

describe("hasActiveFilters", () => {
  it("is false for sort and page only", () => {
    expect(hasActiveFilters(parseListParams({ sort: "price-asc", page: "2" }))).toBe(false);
    expect(hasActiveFilters(parseListParams({ brand: "zoomer" }))).toBe(true);
  });
});
