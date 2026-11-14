import { describe, expect, it } from "vitest";
import { formatDate, formatVnd } from "./format";

// Intl uses a non-breaking space before the currency symbol.
const plain = (s: string) => s.replace(/ /g, " ");

describe("formatVnd", () => {
  it("uses dots as thousand separators and the ₫ sign", () => {
    expect(plain(formatVnd(1250000))).toBe("1.250.000 ₫");
  });

  it("has no decimals", () => {
    expect(plain(formatVnd(4590000.6))).toBe("4.590.001 ₫");
  });

  it("formats zero", () => {
    expect(plain(formatVnd(0))).toBe("0 ₫");
  });
});

describe("formatDate", () => {
  it("formats as dd/MM/yyyy", () => {
    expect(formatDate("2026-11-14T03:00:00Z")).toBe("14/11/2026");
  });

  it("uses Vietnam time (UTC+7) across midnight", () => {
    expect(formatDate("2026-11-14T18:00:00Z")).toBe("15/11/2026");
  });
});
