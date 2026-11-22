import type { ZodError } from "zod";
import type { Issue, IssueCode } from "./errors";

const KNOWN = new Set<string>([
  "invalid_slug",
  "invalid_sku",
  "invalid_url",
  "invalid_color",
  "negative",
  "compare_below_price",
  "duplicate_sku",
  "duplicate_variant",
  "duplicate_color",
  "unknown_color",
  "unknown_variant",
  "unknown_size",
  "mixed_color_options",
  "mixed_size_options",
  "image_target",
]);

const FORMAT_CHECKS = new Set<string>([
  "invalid_slug",
  "invalid_sku",
  "invalid_url",
  "invalid_color",
]);

const valueAt = (raw: unknown, path: (string | number)[]): unknown =>
  path.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === "object"
        ? (value as Record<string | number, unknown>)[key]
        : undefined,
    raw,
  );

/**
 * Zod problems as `{ path: "variants.2.sku", code }`. A custom message that is one of our codes is kept
 * as it is; an empty or missing value is always "required".
 */
export function issuesFromZod(error: ZodError, raw: unknown): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];

  for (const issue of error.issues) {
    const path = issue.path.filter(
      (p): p is string | number =>
        typeof p === "string" || typeof p === "number",
    );
    const key = path.join(".");
    if (seen.has(key)) continue; // one problem per field is enough to act on
    seen.add(key);

    const value = valueAt(raw, path);
    let code: IssueCode;
    // Rules between fields ("this color does not exist", "duplicate variant") keep their own code even when the
    // field is empty. Format checks on a single value (slug, SKU...) say "required" when the value is simply missing.
    if (KNOWN.has(issue.message) && !FORMAT_CHECKS.has(issue.message))
      code = issue.message as IssueCode;
    else if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")
    )
      code = "required";
    else if (KNOWN.has(issue.message)) code = issue.message as IssueCode;
    else if (issue.code === "too_big") code = "too_long";
    else if (issue.code === "too_small") code = "too_short";
    else code = "invalid";
    issues.push({ path: key, code });
  }
  return issues;
}
