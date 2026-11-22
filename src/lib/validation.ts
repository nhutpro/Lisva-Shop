import type { ZodError } from "zod";

/** Why a form field was rejected. Pages turn the code into a translated message. */
export type FieldErrorCode =
  | "required"
  | "invalid_phone"
  | "invalid_email"
  | "too_long"
  | "too_short"
  | "invalid"
  | "email_taken"
  | "password_mismatch"
  | "wrong_password";

export type FieldErrors<F extends string> = Partial<Record<F, FieldErrorCode>>;

function codeFor(issue: ZodError["issues"][number], rawValue: unknown): FieldErrorCode {
  if (typeof rawValue === "string" && rawValue.trim() === "") return "required";
  if (rawValue === undefined || rawValue === null) return "required";
  if (issue.message === "invalid_phone") return "invalid_phone";
  if (issue.message === "password_mismatch") return "password_mismatch";
  if (issue.code === "invalid_format" && "format" in issue && issue.format === "email") return "invalid_email";
  if (issue.code === "too_big") return "too_long";
  if (issue.code === "too_small") return "too_short";
  return "invalid";
}

/**
 * Turns Zod issues into one error code per known field (the first problem of each field).
 * Issues for paths that are not in `fields` are ignored; callers decide what those mean.
 */
export function zodFieldErrors<F extends string>(
  error: ZodError,
  raw: Record<string, unknown>,
  fields: readonly F[],
): FieldErrors<F> {
  const result: FieldErrors<F> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (fields as readonly string[]).includes(field) && !result[field as F]) {
      result[field as F] = codeFor(issue, raw[field]);
    }
  }
  return result;
}
