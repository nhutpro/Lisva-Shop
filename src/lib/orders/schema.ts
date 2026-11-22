import { z } from "zod";

/** Accepts "0912 345 678", "+84 912 345 678", "84912345678"; returns "0912345678". */
export const vnMobile = z
  .string()
  .transform((s) => s.replace(/[\s.\-()]/g, ""))
  .transform((s) => {
    if (s.startsWith("+84")) return `0${s.slice(3)}`;
    if (s.startsWith("84") && s.length === 11) return `0${s.slice(2)}`;
    return s;
  })
  .pipe(z.string().regex(/^0[35789]\d{8}$/, "invalid_phone"));

export const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const orderInputSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: vnMobile,
  email: z.preprocess(emptyToUndefined, z.email().max(200).optional()),
  preferredContact: z.enum(["PHONE", "ZALO"]).default("PHONE"),
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  ward: z.string().trim().min(1).max(100),
  street: z.string().trim().min(1).max(200),
  customerNote: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500).optional(),
  ),
  locale: z.enum(["vi", "en"]).default("vi"),
  userId: z.string().optional(),
  /** Random key from the checkout page. Submitting the same key again returns the same order. */
  idempotencyKey: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
});

export type OrderInput = z.input<typeof orderInputSchema>;
export type ParsedOrderInput = z.output<typeof orderInputSchema>;
