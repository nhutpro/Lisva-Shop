import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_COST, hashPassword, type ScryptCost } from "../auth/password";
import { revokeOtherSessions } from "../auth/session";
import { PASSWORD_MAX, PASSWORD_MIN } from "../auth/schemas";

export type CreateAdminInput = {
  email: string;
  name?: string;
  /** Use this password. When missing, a new account gets a generated one. */
  password?: string;
  /** Give an existing account a new password too (otherwise only its role changes). */
  resetPassword?: boolean;
  cost?: ScryptCost;
};

export type CreateAdminResult = {
  email: string;
  created: boolean;
  /** Set only when this run set a password: the generated one is shown once and never stored in plain text. */
  password?: string;
  generatedPassword: boolean;
};

const emailSchema = z.email().max(200);

/**
 * Creates an administrator, or promotes an existing account to administrator. This is the only way to get
 * the admin role: nothing in the website can grant it.
 */
export async function createOrPromoteAdmin(
  db: PrismaClient,
  input: CreateAdminInput,
): Promise<CreateAdminResult> {
  const parsedEmail = emailSchema.safeParse(input.email.trim());
  if (!parsedEmail.success)
    throw new Error(`"${input.email}" does not look like an email address.`);
  const email = parsedEmail.data.toLowerCase();
  if (
    input.password !== undefined &&
    (input.password.length < PASSWORD_MIN ||
      input.password.length > PASSWORD_MAX)
  ) {
    throw new RangeError(
      `The password must have ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`,
    );
  }
  const cost = input.cost ?? DEFAULT_COST;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (existing) {
    const setPassword = input.resetPassword || !existing.passwordHash;
    const password = setPassword
      ? (input.password ?? randomBytes(15).toString("base64url"))
      : undefined;
    await db.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        ...(password
          ? { passwordHash: await hashPassword(password, cost) }
          : {}),
      },
    });
    if (password) await revokeOtherSessions(db, existing.id); // a new password signs out every device
    return {
      email,
      created: false,
      password,
      generatedPassword: password !== undefined && input.password === undefined,
    };
  }

  const password = input.password ?? randomBytes(15).toString("base64url");
  await db.user.create({
    data: {
      email,
      name: input.name?.trim() || "Admin",
      role: "ADMIN",
      passwordHash: await hashPassword(password, cost),
    },
  });
  return {
    email,
    created: true,
    password,
    generatedPassword: input.password === undefined,
  };
}
