// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "../../test/db";
import { SESSION_DAYS, createSession, deleteExpiredSessions, getSessionUser, revokeOtherSessions, revokeSession } from "./session";

const DAY = 24 * 60 * 60 * 1000;
let userId: string;
let otherId: string;

beforeEach(async () => {
  await resetDb();
  userId = (await testDb.user.create({ data: { email: "an@example.com", name: "An", role: "CUSTOMER" } })).id;
  otherId = (await testDb.user.create({ data: { email: "binh@example.com", name: "Bình" } })).id;
});

describe("createSession", () => {
  it("returns a long random token and stores only its hash", async () => {
    const { token, expires } = await createSession(testDb, userId);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await testDb.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].sessionToken).not.toContain(token);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(expires.getTime()).toBeGreaterThan(Date.now() + (SESSION_DAYS - 1) * DAY);
  });

  it("gives every session a different token", async () => {
    const tokens = await Promise.all(Array.from({ length: 5 }, () => createSession(testDb, userId)));
    expect(new Set(tokens.map((t) => t.token)).size).toBe(5);
  });
});

describe("getSessionUser", () => {
  it("returns only the safe fields of the user", async () => {
    await testDb.user.update({ where: { id: userId }, data: { passwordHash: "scrypt$secret", phone: "0912345678" } });
    const { token } = await createSession(testDb, userId);

    const user = await getSessionUser(testDb, token);
    expect(user).toEqual({ id: userId, email: "an@example.com", name: "An", phone: "0912345678", role: "CUSTOMER", locale: "vi" });
    expect(JSON.stringify(user)).not.toContain("scrypt");
  });

  it("returns null for missing, unknown and malformed tokens", async () => {
    expect(await getSessionUser(testDb, undefined)).toBeNull();
    expect(await getSessionUser(testDb, "")).toBeNull();
    expect(await getSessionUser(testDb, "x".repeat(43))).toBeNull();
    expect(await getSessionUser(testDb, "short")).toBeNull();
    expect(await getSessionUser(testDb, "'; drop table \"User\"; --")).toBeNull();
    expect(await testDb.user.count()).toBe(2);
  });

  it("does not accept the stored hash as a token", async () => {
    await createSession(testDb, userId);
    const [{ sessionToken }] = await testDb.session.findMany();
    expect(await getSessionUser(testDb, sessionToken)).toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    const created = new Date(Date.now() - (SESSION_DAYS + 1) * DAY);
    const { token } = await createSession(testDb, userId, created);

    expect(await getSessionUser(testDb, token)).toBeNull();
    expect(await testDb.session.count()).toBe(0);
  });

  it("stops working when the user is deleted", async () => {
    const { token } = await createSession(testDb, userId);
    await testDb.user.delete({ where: { id: userId } });
    expect(await getSessionUser(testDb, token)).toBeNull();
  });
});

describe("ending sessions", () => {
  it("revokeSession ends one session only", async () => {
    const a = await createSession(testDb, userId);
    const b = await createSession(testDb, userId);
    await revokeSession(testDb, a.token);

    expect(await getSessionUser(testDb, a.token)).toBeNull();
    expect(await getSessionUser(testDb, b.token)).not.toBeNull();
    await revokeSession(testDb, undefined); // harmless
    await revokeSession(testDb, "garbage");
  });

  it("revokeOtherSessions keeps the current session and other users' sessions", async () => {
    const current = await createSession(testDb, userId);
    const phone = await createSession(testDb, userId);
    const laptop = await createSession(testDb, userId);
    const someoneElse = await createSession(testDb, otherId);

    await revokeOtherSessions(testDb, userId, current.token);

    expect(await getSessionUser(testDb, current.token)).not.toBeNull();
    expect(await getSessionUser(testDb, phone.token)).toBeNull();
    expect(await getSessionUser(testDb, laptop.token)).toBeNull();
    expect(await getSessionUser(testDb, someoneElse.token)).not.toBeNull();
  });

  it("revokeOtherSessions without a token ends every session of that user", async () => {
    const a = await createSession(testDb, userId);
    await revokeOtherSessions(testDb, userId);
    expect(await getSessionUser(testDb, a.token)).toBeNull();
  });

  it("deleteExpiredSessions removes only the expired ones", async () => {
    await createSession(testDb, userId, new Date(Date.now() - 40 * DAY));
    await createSession(testDb, userId, new Date(Date.now() - 31 * DAY));
    const live = await createSession(testDb, userId);

    expect(await deleteExpiredSessions(testDb)).toBe(2);
    expect(await getSessionUser(testDb, live.token)).not.toBeNull();
  });
});
