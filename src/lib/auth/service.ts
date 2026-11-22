import { Prisma, type PrismaClient } from "@prisma/client";
import { createRateLimiter } from "../rate-limit";
import { zodFieldErrors, type FieldErrors } from "../validation";
import { DEFAULT_COST, getDummyHash, hashPassword, needsRehash, verifyPassword, type ScryptCost } from "./password";
import {
  PASSWORD_FIELDS,
  PROFILE_FIELDS,
  REGISTER_FIELDS,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
} from "./schemas";
import { revokeOtherSessions, type SessionUser } from "./session";

type Limiter = ReturnType<typeof createRateLimiter>;

export type AuthErrorCode = "INVALID_INPUT" | "EMAIL_TAKEN" | "INVALID_CREDENTIALS" | "RATE_LIMITED";

export type AuthResult<T, F extends string = never> =
  | { ok: true; value: T }
  | { ok: false; error: { code: AuthErrorCode; fieldErrors?: FieldErrors<F>; retryAfterSeconds?: number } };

const TEN_MINUTES = 10 * 60 * 1000;

/** Failed sign-ins are counted three ways, so one person cannot lock out an account on their own. */
export type Limiters = { loginByIp: Limiter; loginByPair: Limiter; loginByEmail: Limiter; register: Limiter; password: Limiter };

export const createLimiters = (now?: () => number): Limiters => ({
  loginByIp: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES, now }),
  loginByPair: createRateLimiter({ limit: 5, windowMs: TEN_MINUTES, now }),
  loginByEmail: createRateLimiter({ limit: 30, windowMs: TEN_MINUTES, now }),
  register: createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000, now }),
  password: createRateLimiter({ limit: 5, windowMs: TEN_MINUTES, now }),
});

export const defaultLimiters = createLimiters();

export type AuthDeps = { db: PrismaClient; cost?: ScryptCost; limiters?: Limiters };

const userSelect = { id: true, email: true, name: true, phone: true, role: true, locale: true } as const;
const limitersOf = (deps: AuthDeps) => deps.limiters ?? defaultLimiters;

const isEmailTaken = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && JSON.stringify(e.meta?.target ?? "").includes("email");

/** Creates an account. The email must be new (compared in lower case). */
export async function registerUser(
  deps: AuthDeps,
  raw: Record<string, unknown>,
  clientKey = "unknown",
): Promise<AuthResult<SessionUser, "name" | "email" | "password" | "phone">> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors: zodFieldErrors(parsed.error, raw, REGISTER_FIELDS) } };
  }

  const limit = limitersOf(deps).register.check(clientKey);
  if (!limit.allowed) return { ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000) } };

  const { name, email, password, phone } = parsed.data;
  const passwordHash = await hashPassword(password, deps.cost ?? DEFAULT_COST);
  try {
    const user = await deps.db.user.create({ data: { name, email, phone, passwordHash }, select: userSelect });
    return { ok: true, value: user };
  } catch (error) {
    if (isEmailTaken(error)) return { ok: false, error: { code: "EMAIL_TAKEN", fieldErrors: { email: "email_taken" } } };
    throw error;
  }
}

/**
 * Checks an email and password. A wrong password, an unknown email and an account without a password all
 * give the same result and take about the same time. Failed attempts are limited per address, per
 * address and email together, and (loosely) per email.
 */
export async function authenticate(
  deps: AuthDeps,
  raw: { email?: unknown; password?: unknown },
  clientKey = "unknown",
): Promise<AuthResult<SessionUser>> {
  const parsed = loginSchema.safeParse({ email: raw.email ?? "", password: raw.password ?? "" });
  const email = parsed.success ? parsed.data.email : "";
  const password = parsed.success ? parsed.data.password : "";
  const limiters = limitersOf(deps);

  const keys = { ip: `ip:${clientKey}`, pair: `pair:${clientKey}|${email}`, email: `email:${email}` };
  const checks = [limiters.loginByIp.peek(keys.ip), limiters.loginByPair.peek(keys.pair), limiters.loginByEmail.peek(keys.email)];
  const blocked = checks.find((c) => !c.allowed);
  if (blocked && !blocked.allowed) {
    return { ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: Math.ceil(blocked.retryAfterMs / 1000) } };
  }

  const cost = deps.cost ?? DEFAULT_COST;
  const user = email ? await deps.db.user.findUnique({ where: { email }, select: { ...userSelect, passwordHash: true } }) : null;
  // Always do one hash comparison, so a missing account is not faster than a wrong password.
  const matches = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash(cost)));

  if (!user || !user.passwordHash || !matches) {
    limiters.loginByIp.record(keys.ip);
    limiters.loginByPair.record(keys.pair);
    limiters.loginByEmail.record(keys.email);
    return { ok: false, error: { code: "INVALID_CREDENTIALS" } };
  }

  limiters.loginByPair.clear(keys.pair);
  if (needsRehash(user.passwordHash, cost)) {
    // Upgrade an old, weaker hash now that we know the password. Failing to do so is not a problem.
    await deps.db.user
      .update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password, cost) } })
      .catch(() => undefined);
  }
  const { passwordHash: _unused, ...safe } = user;
  void _unused;
  return { ok: true, value: safe };
}

export async function updateProfile(
  db: PrismaClient,
  userId: string,
  raw: Record<string, unknown>,
): Promise<AuthResult<SessionUser, "name" | "phone">> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors: zodFieldErrors(parsed.error, raw, PROFILE_FIELDS) } };
  }
  // An empty phone clears it.
  const user = await db.user.update({
    where: { id: userId },
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
    select: userSelect,
  });
  return { ok: true, value: user };
}

/**
 * Changes the password after checking the current one. Every other session is signed out
 * (`keepToken` is the session making the change).
 */
export async function changePassword(
  deps: AuthDeps,
  userId: string,
  raw: Record<string, unknown>,
  keepToken?: string | null,
): Promise<AuthResult<true, "currentPassword" | "newPassword" | "confirmPassword">> {
  const parsed = passwordChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors: zodFieldErrors(parsed.error, raw, PASSWORD_FIELDS) } };
  }

  const limiter = limitersOf(deps).password;
  const key = `user:${userId}`;
  const limit = limiter.peek(key);
  if (!limit.allowed) return { ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000) } };

  const user = await deps.db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  const matches = await verifyPassword(parsed.data.currentPassword, user?.passwordHash ?? (await getDummyHash(deps.cost ?? DEFAULT_COST)));
  if (!user?.passwordHash || !matches) {
    limiter.record(key);
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors: { currentPassword: "wrong_password" } } };
  }

  limiter.clear(key);
  await deps.db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.newPassword, deps.cost ?? DEFAULT_COST) } });
  await revokeOtherSessions(deps.db, userId, keepToken);
  return { ok: true, value: true };
}
