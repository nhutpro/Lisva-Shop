import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    ["/vi/account", "/vi/account"],
    ["/en/account/orders?page=2", "/en/account/orders?page=2"],
    ["/vi/checkout", "/vi/checkout"],
    ["/vi", "/vi"],
    ["/vi/admin/orders/LV-2611-7KQ2?status=PENDING_CONTACT", "/vi/admin/orders/LV-2611-7KQ2?status=PENDING_CONTACT"],
  ])("keeps the in-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "http://evil.com/vi/account",
    "//evil.com/vi/account",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/vi/../../evil",
    "vi/account", // not absolute
    "/fr/account", // not one of our languages
    "/account", // no language section
    "/vi/account\r\nSet-Cookie: x=1",
    "/vi/account\u0000",
    "",
    "/" + "a".repeat(400),
  ])("refuses %j", (input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it("refuses values that are not strings", () => {
    for (const value of [undefined, null, 5, {}, ["/vi/account"]]) expect(safeNextPath(value)).toBeNull();
  });

  it("normalizes dot segments instead of passing them through", () => {
    expect(safeNextPath("/vi/a/./b")).toBe("/vi/a/b");
    expect(safeNextPath("/vi/a/../b")).toBe("/vi/b");
  });
});
