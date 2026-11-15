import { describe, expect, it } from "vitest";
import en from "./dictionaries/en.json";
import vi from "./dictionaries/vi.json";
import { format, pick } from "./format";

// Flattens nested objects to "a.b.c" so the two dictionaries can be compared key by key.
const keys = (obj: unknown, prefix = ""): string[] =>
  obj !== null && typeof obj === "object"
    ? Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const values = (obj: unknown): Record<string, string> =>
  Object.fromEntries(keys(obj).map((k) => [k, k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj) as string]));

describe("dictionaries", () => {
  it("have exactly the same keys in Vietnamese and English", () => {
    expect(keys(en).sort()).toEqual(keys(vi).sort());
  });

  it("have no empty strings", () => {
    for (const [key, value] of Object.entries(values(vi))) expect(value.trim(), `vi ${key}`).not.toBe("");
    for (const [key, value] of Object.entries(values(en))) expect(value.trim(), `en ${key}`).not.toBe("");
  });

  it("use the same placeholders in both languages", () => {
    const v = values(vi);
    const e = values(en);
    for (const key of Object.keys(v)) expect(placeholders(e[key]), key).toBe(placeholders(v[key]));
  });
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("Chỉ còn {count} sản phẩm", { count: 3 })).toBe("Chỉ còn 3 sản phẩm");
    expect(format("{a} và {b}", { a: "x" })).toBe("x và {b}");
  });
});

describe("pick", () => {
  it("uses English when available, otherwise Vietnamese", () => {
    expect(pick("en", "Giày", "Shoes")).toBe("Shoes");
    expect(pick("en", "Giày", null)).toBe("Giày");
    expect(pick("vi", "Giày", "Shoes")).toBe("Giày");
    expect(pick("vi", null, "Shoes")).toBeNull();
  });
});
