import { describe, expect, it } from "vitest";
import { orderInputSchema } from "./schema";

const base = {
  customerName: "Nguyễn An",
  phone: "0912345678",
  province: "TP. Hồ Chí Minh",
  district: "Quận 1",
  ward: "Bến Nghé",
  street: "12 Lê Lợi",
  items: [{ variantId: "v1", quantity: 1 }],
};

describe("orderInputSchema", () => {
  it.each([
    ["0912 345 678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["0912.345.678", "0912345678"],
  ])("normalizes phone %s", (input, expected) => {
    expect(orderInputSchema.parse({ ...base, phone: input }).phone).toBe(expected);
  });

  it.each(["12345", "0112345678", "abc", ""])("rejects phone %j", (phone) => {
    expect(orderInputSchema.safeParse({ ...base, phone }).success).toBe(false);
  });

  it("defaults contact to PHONE and locale to vi", () => {
    const parsed = orderInputSchema.parse(base);
    expect(parsed.preferredContact).toBe("PHONE");
    expect(parsed.locale).toBe("vi");
  });

  it("treats an empty email and note as missing", () => {
    const parsed = orderInputSchema.parse({ ...base, email: "", customerNote: "  " });
    expect(parsed.email).toBeUndefined();
    expect(parsed.customerNote).toBeUndefined();
  });

  it("rejects an empty cart and bad quantities", () => {
    expect(orderInputSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, items: [{ variantId: "v1", quantity: 0 }] }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...base, items: [{ variantId: "v1", quantity: 99 }] }).success).toBe(false);
  });
});
