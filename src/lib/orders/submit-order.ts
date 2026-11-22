import type { PrismaClient } from "@prisma/client";
import type { ZodError } from "zod";
import type { RateLimitResult } from "../rate-limit";
import type { OrderAlertInput } from "../telegram";
import {
  FIELD_NAMES,
  type FieldErrorCode,
  type FieldErrors,
  type FieldName,
  type SubmitResult,
} from "./checkout-state";
import { createOrderOnce } from "./create-order";
import { OrderError } from "./errors";
import { generateOrderCode } from "./order-code";
import { orderInputSchema } from "./schema";

export type SubmitDeps = {
  db: PrismaClient;
  limiter: { check(key: string): RateLimitResult };
  /** Called once for a newly created order, after it is saved. It must not throw into the caller. */
  notify: (order: OrderAlertInput) => void;
  /** Logs a problem without personal data. */
  log?: (message: string) => void;
};

export type SubmitInput = {
  /** The form values plus `items` (variantId and quantity), as received from the browser. */
  raw: Record<string, unknown>;
  /** Identifies the client for rate limiting (an IP address). */
  clientKey: string;
  /** Value of the hidden trap field. Real shoppers never fill it. */
  honeypot?: string;
};

const isFieldName = (value: unknown): value is FieldName =>
  (FIELD_NAMES as readonly unknown[]).includes(value);

function fieldErrorCode(
  issue: ZodError["issues"][number],
  rawValue: unknown,
): FieldErrorCode {
  if (typeof rawValue === "string" && rawValue.trim() === "") return "required";
  if (issue.message === "invalid_phone") return "invalid_phone";
  if (
    issue.code === "invalid_format" &&
    "format" in issue &&
    issue.format === "email"
  )
    return "invalid_email";
  if (issue.code === "too_big") return "too_long";
  if (issue.code === "too_small" || issue.code === "invalid_type")
    return "required";
  return "invalid";
}

function toFieldErrors(
  error: ZodError,
  raw: Record<string, unknown>,
): { fieldErrors: FieldErrors; emptyCart: boolean } {
  const fieldErrors: FieldErrors = {};
  let emptyCart = false;
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "items") emptyCart = true;
    else if (isFieldName(field) && !fieldErrors[field])
      fieldErrors[field] = fieldErrorCode(issue, raw[field]);
  }
  return { fieldErrors, emptyCart };
}

/**
 * Validates an order request, creates it once, and schedules the owner alert.
 * Never throws: every problem comes back as `{ ok: false, error }` with a stable code.
 */
export async function submitOrder(
  deps: SubmitDeps,
  input: SubmitInput,
): Promise<SubmitResult> {
  const log =
    deps.log ?? ((message: string) => console.error(`[order] ${message}`));

  // A bot filled the hidden field: pretend it worked, create nothing.
  if (input.honeypot && input.honeypot.trim() !== "") {
    return { ok: true, code: generateOrderCode() };
  }

  // Validate first: a request with mistakes creates nothing and costs nothing, so a shopper fixing
  // typos must not use up the limit. Only well-formed requests (which reach the database) are counted.
  const parsed = orderInputSchema.safeParse(input.raw);
  if (!parsed.success) {
    const { fieldErrors, emptyCart } = toFieldErrors(parsed.error, input.raw);
    if (emptyCart && Object.keys(fieldErrors).length === 0)
      return { ok: false, error: { code: "EMPTY_CART" } };
    return { ok: false, error: { code: "INVALID_INPUT", fieldErrors } };
  }

  const limit = deps.limiter.check(input.clientKey);
  if (!limit.allowed) {
    return {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
      },
    };
  }

  try {
    const { order, created } = await createOrderOnce(deps.db, parsed.data);
    if (created) {
      // The order is already saved. A problem with the alert must never turn into a failed order.
      try {
        deps.notify(order);
      } catch {
        log("could not schedule the owner alert");
      }
    }
    return { ok: true, code: order.code };
  } catch (error) {
    if (error instanceof OrderError) {
      const variantId =
        typeof error.detail?.variantId === "string"
          ? error.detail.variantId
          : undefined;
      if (
        error.code === "OUT_OF_STOCK" ||
        error.code === "VARIANT_UNAVAILABLE" ||
        error.code === "VARIANT_NOT_FOUND"
      ) {
        return { ok: false, error: { code: error.code, variantId } };
      }
    }
    // Log the kind of failure only: database error messages can contain the customer's details.
    const kind =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "unknown";
    log(`could not create an order (${name}${kind ? ` ${kind}` : ""})`);
    return { ok: false, error: { code: "UNKNOWN" } };
  }
}
