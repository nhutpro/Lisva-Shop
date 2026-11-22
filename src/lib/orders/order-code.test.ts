import { describe, expect, it } from "vitest";
import { generateOrderCode } from "./order-code";

describe("generateOrderCode", () => {
  it("has the form LV-YYMM-XXXX without confusing characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOrderCode()).toMatch(/^LV-\d{4}-[2-9A-HJ-NP-Z]{4}$/);
    }
  });

  it("uses year and month in Vietnam time", () => {
    // 2026-11-30 20:00 UTC is already December 1st in Vietnam (UTC+7).
    expect(generateOrderCode(new Date("2026-11-30T20:00:00Z"), () => 0)).toBe(
      "LV-2612-2222",
    );
    expect(generateOrderCode(new Date("2026-11-14T03:00:00Z"), () => 0)).toBe(
      "LV-2611-2222",
    );
  });
});
