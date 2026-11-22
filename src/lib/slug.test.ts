import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Giày chạy bộ Zoomer Runner 2", "giay-chay-bo-zoomer-runner-2"],
    ["Đồng hồ Tide  Classic!", "dong-ho-tide-classic"],
    ["  --Hello__World--  ", "hello-world"],
    ["ĐĂNG QUANG", "dang-quang"],
    ["100% cotton / size 42", "100-cotton-size-42"],
    ["", ""],
    ["!!!", ""],
  ])("%j -> %j", (input, expected) => expect(slugify(input)).toBe(expected));

  it("cuts long text without leaving a trailing dash", () => {
    const slug = slugify("a".repeat(10) + " " + "b".repeat(10), 11);
    expect(slug).toBe("aaaaaaaaaa");
    expect(slug.length).toBeLessThanOrEqual(11);
  });

  it("always produces a valid slug", () => {
    for (const text of ["Giày 42", "Đồng hồ — Đen", "x y z"]) expect(SLUG_PATTERN.test(slugify(text))).toBe(true);
  });
});

describe("SLUG_PATTERN", () => {
  it.each(["a", "giay-42", "a1-b2-c3"])("accepts %s", (s) => expect(SLUG_PATTERN.test(s)).toBe(true));
  it.each(["", "-a", "a-", "a--b", "A", "a b", "giày", "a_b"])("rejects %j", (s) => expect(SLUG_PATTERN.test(s)).toBe(false));
});
