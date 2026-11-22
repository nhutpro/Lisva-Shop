// Result types shared by the admin functions. Codes are stable; the pages turn them into translated text.

export type IssueCode =
  | "required"
  | "too_long"
  | "too_short"
  | "invalid"
  | "invalid_slug"
  | "invalid_sku"
  | "invalid_url"
  | "invalid_color"
  | "negative"
  | "compare_below_price"
  | "duplicate_sku"
  | "duplicate_variant"
  | "duplicate_color"
  | "unknown_color"
  | "unknown_variant"
  | "unknown_size"
  | "mixed_color_options"
  | "mixed_size_options"
  | "image_target"
  | "slug_taken"
  | "sku_taken"
  | "name_taken"
  | "prefix_taken"
  | "label_taken"
  | "not_found";

/** One problem, at a path such as "nameVi" or "variants.2.sku". */
export type Issue = { path: string; code: IssueCode };

export type AdminErrorCode =
  "INVALID_INPUT" | "NOT_FOUND" | "IN_USE" | "CONFLICT" | "UNKNOWN";

export type AdminResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: { code: AdminErrorCode; issues?: Issue[]; usedBy?: number };
    };

export const failure = (
  code: AdminErrorCode,
  extra: { issues?: Issue[]; usedBy?: number } = {},
) => ({ ok: false, error: { code, ...extra } }) as const;

export const success = <T>(value: T) => ({ ok: true, value }) as const;
