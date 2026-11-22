// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "../../test/db";
import { hashPassword, verifyPassword, type ScryptCost } from "./password";
import { authenticate, changePassword, createLimiters, registerUser, updateProfile, type AuthDeps } from "./service";
import { createSession, getSessionUser } from "./session";

const CHEAP: ScryptCost = { N: 2 ** 10, r: 8, p: 1 };
let clock = 1_000_000;
let deps: AuthDeps;

const valid = (extra: Record<string, unknown> = {}) => ({
  name: "Nguyễn An",
  email: "an@example.com",
  password: "mat-khau-an-toan",
  ...extra,
});

beforeEach(async () => {
  await resetDb();
  clock = 1_000_000;
  deps = { db: testDb, cost: CHEAP, limiters: createLimiters(() => clock) };
});

async function createUser(email = "an@example.com", password = "mat-khau-an-toan", role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  return testDb.user.create({ data: { email, name: "An", role, passwordHash: await hashPassword(password, CHEAP) } });
}

describe("registerUser", () => {
  it("creates an account with a lower-case email, a normalized phone and only a password hash", async () => {
    const result = await registerUser(deps, valid({ email: "  An@Example.COM ", phone: "0912 345 678" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      id: expect.any(String),
      email: "an@example.com",
      name: "Nguyễn An",
      phone: "0912345678",
      role: "CUSTOMER",
      locale: "vi",
    });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|scrypt|mat-khau/);

    const row = await testDb.user.findUniqueOrThrow({ where: { id: result.value.id } });
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("mat-khau-an-toan");
    expect(await verifyPassword("mat-khau-an-toan", row.passwordHash!)).toBe(true);
  });

  it("accepts a missing phone", async () => {
    expect((await registerUser(deps, valid({ phone: "" }))).ok).toBe(true);
  });

  it("refuses an email that is already used, whatever its letter case", async () => {
    await registerUser(deps, valid());
    const again = await registerUser(deps, valid({ email: "AN@example.com", name: "Someone else" }));

    expect(again).toEqual({ ok: false, error: { code: "EMAIL_TAKEN", fieldErrors: { email: "email_taken" } } });
    expect(await testDb.user.count()).toBe(1);
  });

  it("creates exactly one account when the same email is submitted at once", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => registerUser(deps, valid())));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error.code === "EMAIL_TAKEN")).toHaveLength(3);
    expect(await testDb.user.count()).toBe(1);
  });

  it("reports each problem on its own field and creates nothing", async () => {
    const result = await registerUser(deps, { name: "", email: "not-an-email", password: "short", phone: "123" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: { name: "required", email: "invalid_email", password: "too_short", phone: "invalid_phone" },
      },
    });
    expect(await testDb.user.count()).toBe(0);
  });

  it("limits the length of the password and reports a missing one", async () => {
    const long = await registerUser(deps, valid({ password: "x".repeat(129) }));
    expect(long.ok === false && long.error.fieldErrors).toEqual({ password: "too_long" });
    const missing = await registerUser(deps, { name: "An", email: "an@example.com" });
    expect(missing.ok === false && missing.error.fieldErrors).toEqual({ password: "required" });
  });

  it("limits how many accounts one address can create", async () => {
    for (let i = 0; i < 10; i++) expect((await registerUser(deps, valid({ email: `u${i}@example.com` }), "1.2.3.4")).ok).toBe(true);
    const blocked = await registerUser(deps, valid({ email: "u11@example.com" }), "1.2.3.4");
    expect(blocked.ok === false && blocked.error.code).toBe("RATE_LIMITED");
    expect((await registerUser(deps, valid({ email: "other@example.com" }), "5.6.7.8")).ok).toBe(true);
  });
});

describe("authenticate", () => {
  it("signs in with the right password, ignoring email case and spaces", async () => {
    await createUser();
    const result = await authenticate(deps, { email: "  AN@Example.com ", password: "mat-khau-an-toan" });
    expect(result).toMatchObject({ ok: true, value: { email: "an@example.com", role: "CUSTOMER" } });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|scrypt/);
  });

  it("gives exactly the same answer for a wrong password, an unknown email and an account without a password", async () => {
    await createUser();
    await testDb.user.create({ data: { email: "nopass@example.com" } });

    const wrong = await authenticate(deps, { email: "an@example.com", password: "wrong-password" });
    const unknown = await authenticate(deps, { email: "nobody@example.com", password: "wrong-password" });
    const none = await authenticate(deps, { email: "nopass@example.com", password: "anything" });

    expect(wrong).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
    expect(unknown).toEqual(wrong);
    expect(none).toEqual(wrong);
  });

  it("treats malformed input as a failed attempt, not a crash", async () => {
    await createUser();
    for (const raw of [{}, { email: 5, password: {} }, { email: null, password: null }, { email: "x".repeat(500), password: "y".repeat(500) }]) {
      expect(await authenticate(deps, raw)).toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
    }
  });

  it("blocks an address and email after 5 failures, even for the right password, with a retry time", async () => {
    await createUser();
    for (let i = 0; i < 5; i++) await authenticate(deps, { email: "an@example.com", password: `bad-${i}` }, "9.9.9.9");

    const blocked = await authenticate(deps, { email: "an@example.com", password: "mat-khau-an-toan" }, "9.9.9.9");
    expect(blocked).toEqual({ ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: expect.any(Number) } });
    expect(blocked.ok === false && blocked.error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not let one person lock the real owner out from another address", async () => {
    await createUser();
    for (let i = 0; i < 8; i++) await authenticate(deps, { email: "an@example.com", password: `bad-${i}` }, "6.6.6.6");

    const owner = await authenticate(deps, { email: "an@example.com", password: "mat-khau-an-toan" }, "7.7.7.7");
    expect(owner.ok).toBe(true);
  });

  it("blocks an address that tries many different emails", async () => {
    for (let i = 0; i < 10; i++) await authenticate(deps, { email: `guess${i}@example.com`, password: "x" }, "8.8.8.8");
    const blocked = await authenticate(deps, { email: "another@example.com", password: "x" }, "8.8.8.8");
    expect(blocked.ok === false && blocked.error.code).toBe("RATE_LIMITED");
  });

  it("a successful sign-in resets the failures for that address and email", async () => {
    await createUser();
    const attempt = (password: string) => authenticate(deps, { email: "an@example.com", password }, "4.4.4.4");
    for (let i = 0; i < 4; i++) await attempt("bad");
    expect((await attempt("mat-khau-an-toan")).ok).toBe(true); // 4 failures so far, still allowed, and it resets the pair
    for (let i = 0; i < 4; i++) await attempt("bad"); // 4 more would have been 8 without the reset (limit is 5)
    expect((await attempt("mat-khau-an-toan")).ok).toBe(true);
  });

  it("allows attempts again after the window has passed", async () => {
    await createUser();
    for (let i = 0; i < 5; i++) await authenticate(deps, { email: "an@example.com", password: "bad" }, "3.3.3.3");
    clock += 10 * 60 * 1000 + 1;
    expect((await authenticate(deps, { email: "an@example.com", password: "mat-khau-an-toan" }, "3.3.3.3")).ok).toBe(true);
  });

  it("upgrades an older, weaker password hash after a successful sign-in", async () => {
    await testDb.user.create({
      data: { email: "old@example.com", passwordHash: await hashPassword("old-password-1", { N: 2 ** 9, r: 8, p: 1 }) },
    });
    expect((await authenticate(deps, { email: "old@example.com", password: "old-password-1" })).ok).toBe(true);

    const { passwordHash } = await testDb.user.findUniqueOrThrow({ where: { email: "old@example.com" } });
    expect(passwordHash).toMatch(/^scrypt\$1024\$/);
    expect(await verifyPassword("old-password-1", passwordHash!)).toBe(true);
  });
});

describe("updateProfile", () => {
  it("changes the name and phone, and clears the phone when it is emptied", async () => {
    const user = await createUser();
    const changed = await updateProfile(testDb, user.id, { name: "  Trần Bình ", phone: "+84 912 345 678" });
    expect(changed).toMatchObject({ ok: true, value: { name: "Trần Bình", phone: "0912345678" } });

    const cleared = await updateProfile(testDb, user.id, { name: "Trần Bình", phone: "" });
    expect(cleared).toMatchObject({ ok: true, value: { phone: null } });
  });

  it("reports field problems and leaves the account unchanged", async () => {
    const user = await createUser();
    const result = await updateProfile(testDb, user.id, { name: "A", phone: "abc" });
    expect(result).toEqual({ ok: false, error: { code: "INVALID_INPUT", fieldErrors: { name: "too_short", phone: "invalid_phone" } } });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("An");
  });

  it("never changes email or role", async () => {
    const user = await createUser();
    await updateProfile(testDb, user.id, { name: "An", email: "hacker@example.com", role: "ADMIN" });
    const row = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect([row.email, row.role]).toEqual(["an@example.com", "CUSTOMER"]);
  });
});

describe("changePassword", () => {
  const change = (userId: string, extra: Record<string, unknown> = {}, keep?: string) =>
    changePassword(deps, userId, { currentPassword: "mat-khau-an-toan", newPassword: "mat-khau-moi-123", confirmPassword: "mat-khau-moi-123", ...extra }, keep);

  it("needs the current password", async () => {
    const user = await createUser();
    const result = await change(user.id, { currentPassword: "not-my-password" });
    expect(result).toEqual({ ok: false, error: { code: "INVALID_INPUT", fieldErrors: { currentPassword: "wrong_password" } } });
    expect(await authenticate(deps, { email: "an@example.com", password: "mat-khau-an-toan" })).toMatchObject({ ok: true });
  });

  it("checks the confirmation and the length of the new password", async () => {
    const user = await createUser();
    const mismatch = await change(user.id, { confirmPassword: "different-123" });
    expect(mismatch.ok === false && mismatch.error.fieldErrors).toEqual({ confirmPassword: "password_mismatch" });
    const short = await change(user.id, { newPassword: "short", confirmPassword: "short" });
    expect(short.ok === false && short.error.fieldErrors).toEqual({ newPassword: "too_short" });
  });

  it("replaces the password, and signs out every other session but keeps the current one", async () => {
    const user = await createUser();
    const current = await createSession(testDb, user.id);
    const stolen = await createSession(testDb, user.id);

    expect(await change(user.id, {}, current.token)).toEqual({ ok: true, value: true });

    expect(await authenticate(deps, { email: "an@example.com", password: "mat-khau-an-toan" })).toMatchObject({ ok: false });
    expect(await authenticate(deps, { email: "an@example.com", password: "mat-khau-moi-123" })).toMatchObject({ ok: true });
    expect(await getSessionUser(testDb, current.token)).not.toBeNull();
    expect(await getSessionUser(testDb, stolen.token)).toBeNull();
  });

  it("limits guesses of the current password", async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i++) await change(user.id, { currentPassword: `guess-${i}` });
    const blocked = await change(user.id); // even the right one
    expect(blocked.ok === false && blocked.error.code).toBe("RATE_LIMITED");
  });
});
