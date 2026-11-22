import { z } from "zod";
import { emptyToUndefined, vnMobile } from "../orders/schema";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const name = z.string().trim().min(2).max(100);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const optionalPhone = z.preprocess(emptyToUndefined, vnMobile.optional());

/** Emails are compared in lower case. */
const email = z
  .string()
  .trim()
  .max(200)
  .pipe(z.email())
  .transform((s) => s.toLowerCase());

export const registerSchema = z.object({
  name,
  email,
  password,
  phone: optionalPhone,
});
export const REGISTER_FIELDS = ["name", "email", "password", "phone"] as const;

export const profileSchema = z.object({ name, phone: optionalPhone });
export const PROFILE_FIELDS = ["name", "phone"] as const;

export const passwordChangeSchema = z
  .object({ currentPassword: z.string().min(1).max(PASSWORD_MAX), newPassword: password, confirmPassword: z.string().max(PASSWORD_MAX) })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "password_mismatch" });
export const PASSWORD_FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

export const addressSchema = z.object({
  recipientName: name,
  phone: vnMobile,
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  ward: z.string().trim().min(1).max(100),
  street: z.string().trim().min(1).max(200),
  isDefault: z.boolean().default(false),
});
export const ADDRESS_FIELDS = ["recipientName", "phone", "province", "district", "ward", "street"] as const;

export const MAX_ADDRESSES = 10;

/** Login only needs "something that can be compared"; malformed input is just a failed attempt. */
export const loginSchema = z.object({
  email: z.string().trim().max(200).transform((s) => s.toLowerCase()),
  password: z.string().max(PASSWORD_MAX),
});
