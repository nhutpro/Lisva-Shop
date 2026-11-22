"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { getClientKey } from "@/lib/client-key";
import { listAddresses, saveAddress, type AddressData } from "@/lib/auth/addresses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sendOrderAlert } from "@/lib/orders/alert";
import { FIELD_NAMES, type CheckoutState, type FieldName } from "@/lib/orders/checkout-state";
import { submitOrder } from "@/lib/orders/submit-order";
import { orderRateLimiter } from "@/lib/rate-limit";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : undefined);

export type CheckoutDefaults = {
  user: { name: string | null; email: string; phone: string | null };
  addresses: AddressData[];
} | null;

/** What to pre-fill for a signed-in shopper (their details and saved addresses). Guests get null. */
export async function loadCheckoutDefaults(): Promise<CheckoutDefaults> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user: { name: user.name, email: user.email, phone: user.phone }, addresses: await listAddresses(db, user.id) };
}

/**
 * Order request from the checkout form. All the rules live in `submitOrder`; this only reads the
 * request, so it stays thin. The Telegram alert is sent after the response (`after`), so the shopper
 * never waits for it. A signed-in shopper's order is linked to their account.
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

  const user = await getCurrentUser();
  const result = await submitOrder(
    { db, limiter: orderRateLimiter, notify: (order) => after(() => sendOrderAlert(order)) },
    {
      raw: {
        ...values,
        locale: text(formData.get("locale")),
        idempotencyKey: text(formData.get("idempotencyKey")) || undefined,
        userId: user?.id,
        items,
      },
      clientKey: await getClientKey(),
      honeypot: text(formData.get("website")),
    },
  );
  if (!result.ok) return { status: "error", error: result.error, values };

  // Optional: remember the address. The order is already saved, so a problem here is ignored.
  if (user && formData.get("saveAddress") === "on") {
    await saveAddress(db, user.id, {
      recipientName: values.customerName,
      phone: values.phone,
      province: formData.get("province"),
      district: formData.get("district"),
      ward: formData.get("ward"),
      street: formData.get("street"),
      isDefault: false,
    }).catch(() => undefined);
  }
  return { status: "success", code: result.code };
}
