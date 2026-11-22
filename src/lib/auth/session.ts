import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// Sessions live in the database. The browser holds a random token; only its SHA-256 hash is stored,
// so a copy of the database cannot be used to sign in as anyone.

export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the rest of the app may know about the signed-in person. */
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
  locale: string;
};

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(
  db: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await db.session.create({ data: { sessionToken: hashToken(token), userId, expires } });
  return { token, expires };
}

/** The user for a session token, or null when the token is unknown, malformed or expired. */
export async function getSessionUser(
  db: PrismaClient,
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<SessionUser | null> {
  if (!token || !TOKEN_FORMAT.test(token)) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, phone: true, role: true, locale: true } } },
  });
  if (!session) return null;
  if (session.expires.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function revokeSession(db: PrismaClient, token: string | undefined | null): Promise<void> {
  if (!token || !TOKEN_FORMAT.test(token)) return;
  await db.session.deleteMany({ where: { sessionToken: hashToken(token) } });
}

/** Signs a user out everywhere except (optionally) the session that is making the change. */
export async function revokeOtherSessions(db: PrismaClient, userId: string, keepToken?: string | null): Promise<void> {
  const keep = keepToken && TOKEN_FORMAT.test(keepToken) ? hashToken(keepToken) : undefined;
  await db.session.deleteMany({ where: { userId, ...(keep ? { sessionToken: { not: keep } } : {}) } });
}

export async function deleteExpiredSessions(db: PrismaClient, now: Date = new Date()): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { expires: { lte: now } } });
  return count;
}
