// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDummyHash, hashPassword, needsRehash, verifyPassword, type ScryptCost } from "./password";

// Cheap settings keep the tests fast; the real default is much stronger.
const CHEAP: ScryptCost = { N: 2 ** 10, r: 8, p: 1 };

describe("hashPassword and verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery", CHEAP);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("stores the cost parameters, a salt, and never the password", async () => {
    const hash = await hashPassword("s3cret-Mật-khẩu", CHEAP);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain("s3cret");
  });

  it("uses a new salt every time, so equal passwords give different hashes that both verify", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password", CHEAP), hashPassword("same-password", CHEAP)]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });

  it("treats a composed and a decomposed Vietnamese accent as the same password", async () => {
    const composed = "mậtkhẩu123"; // precomposed characters
    const decomposed = composed.normalize("NFD"); // base letters plus combining marks
    expect(composed).not.toBe(decomposed);
    const hash = await hashPassword(composed, CHEAP);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it("verifies hashes made with other cost settings", async () => {
    const other = await hashPassword("pw-12345678", { N: 2 ** 11, r: 8, p: 2 });
    expect(await verifyPassword("pw-12345678", other)).toBe(true);
  });

  it.each([
    "",
    "plaintext",
    "scrypt$1024$8$1$abc",
    "bcrypt$1024$8$1$c2FsdA==$a2V5",
    "scrypt$1000$8$1$c2FsdA==$a2V5", // N is not a power of two
    "scrypt$1073741824$8$1$c2FsdA==$a2V5", // absurdly large N
    "scrypt$1024$8$1$c2FsdA==$short",
  ])("never matches the malformed stored value %j", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });
});

describe("needsRehash", () => {
  it("is true for weaker or broken hashes and false for equal or stronger ones", async () => {
    const weak = await hashPassword("x", CHEAP);
    expect(needsRehash(weak, { N: 2 ** 11, r: 8, p: 1 })).toBe(true);
    expect(needsRehash(weak, CHEAP)).toBe(false);
    expect(needsRehash(weak, { N: 2 ** 9, r: 8, p: 1 })).toBe(false);
    expect(needsRehash("garbage", CHEAP)).toBe(true);
  });
});

describe("getDummyHash", () => {
  it("returns one reusable valid hash", async () => {
    const first = await getDummyHash(CHEAP);
    expect(await getDummyHash(CHEAP)).toBe(first);
    expect(first.startsWith("scrypt$")).toBe(true);
  });
});
