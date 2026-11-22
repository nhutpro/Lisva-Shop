// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "../../test/db";
import { verifyPassword, type ScryptCost } from "../auth/password";
import { createSession, getSessionUser } from "../auth/session";
import { createOrPromoteAdmin } from "./create-admin";

const cost: ScryptCost = { N: 2 ** 10, r: 8, p: 1 };
const make = (
  extra: Partial<Parameters<typeof createOrPromoteAdmin>[1]> = {},
) =>
  createOrPromoteAdmin(testDb, { email: "Owner@Example.com", cost, ...extra });

beforeEach(resetDb);

describe("createOrPromoteAdmin", () => {
  it("creates an administrator with a generated password that works and is not stored in plain text", async () => {
    const result = await make({ name: "Chủ shop" });
    expect(result).toMatchObject({
      email: "owner@example.com",
      created: true,
      generatedPassword: true,
    });
    expect(result.password).toMatch(/^[A-Za-z0-9_-]{20}$/);

    const user = await testDb.user.findUniqueOrThrow({
      where: { email: "owner@example.com" },
    });
    expect(user).toMatchObject({ role: "ADMIN", name: "Chủ shop" });
    expect(user.passwordHash).not.toContain(result.password!);
    expect(await verifyPassword(result.password!, user.passwordHash!)).toBe(
      true,
    );
  });

  it("uses the password it is given", async () => {
    const result = await make({ password: "my-long-password" });
    expect(result.generatedPassword).toBe(false);
    const user = await testDb.user.findUniqueOrThrow({
      where: { email: "owner@example.com" },
    });
    expect(await verifyPassword("my-long-password", user.passwordHash!)).toBe(
      true,
    );
  });

  it("promotes an existing customer and keeps their password", async () => {
    const before = await testDb.user.create({
      data: {
        email: "owner@example.com",
        name: "An",
        passwordHash: "scrypt$keep",
      },
    });
    const result = await make();

    expect(result).toEqual({
      email: "owner@example.com",
      created: false,
      password: undefined,
      generatedPassword: false,
    });
    const after = await testDb.user.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect([after.role, after.passwordHash, after.name]).toEqual([
      "ADMIN",
      "scrypt$keep",
      "An",
    ]);
    expect(await testDb.user.count()).toBe(1);
  });

  it("gives an existing account without a password a new one", async () => {
    await testDb.user.create({ data: { email: "owner@example.com" } });
    const result = await make();
    expect(result.password).toBeTruthy();
    const user = await testDb.user.findUniqueOrThrow({
      where: { email: "owner@example.com" },
    });
    expect(await verifyPassword(result.password!, user.passwordHash!)).toBe(
      true,
    );
  });

  it("sets a new password on request and signs out every session", async () => {
    const existing = await testDb.user.create({
      data: { email: "owner@example.com", passwordHash: "scrypt$old" },
    });
    const { token } = await createSession(testDb, existing.id);

    const result = await make({ resetPassword: true });
    expect(result.generatedPassword).toBe(true);
    expect(await getSessionUser(testDb, token)).toBeNull();
    const user = await testDb.user.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(await verifyPassword(result.password!, user.passwordHash!)).toBe(
      true,
    );
  });

  it("refuses a malformed email or a weak password without creating anything", async () => {
    await expect(make({ email: "not-an-email" })).rejects.toThrow();
    await expect(make({ password: "short" })).rejects.toThrow(RangeError);
    expect(await testDb.user.count()).toBe(0);
  });
});
