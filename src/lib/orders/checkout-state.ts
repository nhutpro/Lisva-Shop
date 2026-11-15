// Plain types shared by the checkout server action and the checkout page (no server imports here).

export const FIELD_NAMES = [
  "customerName",
  "phone",
  "email",
  "preferredContact",
  "province",
  "district",
  "ward",
  "street",
  "customerNote",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

/** Why one field was rejected. The page turns it into a translated message. */
export type FieldErrorCode = "required" | "invalid_phone" | "invalid_email" | "too_long" | "invalid";
export type FieldErrors = Partial<Record<FieldName, FieldErrorCode>>;

export type SubmitErrorCode =
  | "INVALID_INPUT"
  | "EMPTY_CART"
  | "RATE_LIMITED"
  | "OUT_OF_STOCK"
  | "VARIANT_UNAVAILABLE"
  | "VARIANT_NOT_FOUND"
  | "UNKNOWN";

export type SubmitResult =
  | { ok: true; code: string }
  | {
      ok: false;
      error: {
        code: SubmitErrorCode;
        fieldErrors?: FieldErrors;
        /** The cart line that caused OUT_OF_STOCK / VARIANT_*. */
        variantId?: string;
        retryAfterSeconds?: number;
      };
    };

/** What the checkout form shows between submits. `values` brings back what the shopper typed. */
export type CheckoutState =
  | { status: "idle"; values?: Partial<Record<FieldName, string>> }
  | { status: "success"; code: string }
  | { status: "error"; error: Extract<SubmitResult, { ok: false }>["error"]; values: Partial<Record<FieldName, string>> };
