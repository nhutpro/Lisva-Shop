import { describe, expect, it } from "vitest";
import { buildSearchText, normalizeSearch } from "./search";

describe("normalizeSearch", () => {
  it("removes Vietnamese diacritics and lowercases", () => {
    expect(normalizeSearch("Giày Thể Thao")).toBe("giay the thao");
  });

  it("turns đ into d", () => {
    expect(normalizeSearch("Đồng hồ")).toBe("dong ho");
  });

  it("collapses whitespace", () => {
    expect(normalizeSearch("  giay   den ")).toBe("giay den");
  });
});

describe("buildSearchText", () => {
  it("joins the parts and skips empty ones", () => {
    expect(buildSearchText("Giày Zoomer", null, undefined, "Đồng hồ")).toBe("giay zoomer dong ho");
  });
});
