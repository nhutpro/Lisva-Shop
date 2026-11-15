"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendOrderAlert } from "@/lib/orders/alert";
import { FIELD_NAMES, type CheckoutState, type FieldName } from "@/lib/orders/checkout-state";
import { submitOrder } from "@/lib/orders/submit-order";
import { orderRateLimiter } from "@/lib/rate-limit";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : undefined);

/**
 * Order request from the checkout form. All the rules live in `submitOrder`; this only reads the
 * request, so it stays thin. The Telegram alert is sent after the response (`after`), so the shopper
 * never waits for it.
 */
export async function submitOrderAction(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  // Keep what was typed so an error does not erase the form (React clears uncontrolled fields after an action).
  const values: Partial<Record<FieldName, string>> = {};
  for (const name of FIELD_NAMES) {
    const value = text(formData.get(name));
    if (value !== undefined) values[name] = value;
  }

  let items: unknown = [];
  try {
    items = JSON.parse(text(formData.get("items")) ?? "[]");
  } catch {
    // malformed cart data is reported as an empty cart by validation
  }

  const requestHeaders = await headers();
  const clientKey = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";

  const result = await submitOrder(
    { db, limiter: orderRateLimiter, notify: (order) => after(() => sendOrderAlert(order)) },
    {
      raw: {
        ...values,
        locale: text(formData.get("locale")),
        idempotencyKey: text(formData.get("idempotencyKey")) || undefined,
        items,
      },
      clientKey,
      honeypot: text(formData.get("website")),
    },
  );

  return result.ok ? { status: "success", code: result.code } : { status: "error", error: result.error, values };
}
