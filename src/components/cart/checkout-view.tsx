"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { loadCheckoutDefaults, submitOrderAction, type CheckoutDefaults } from "@/app/[lang]/checkout/actions";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useCartStore } from "@/lib/cart/store";
import { useCartLines } from "@/lib/cart/use-cart-lines";
import { formatVnd } from "@/lib/format";
import type { CheckoutState, FieldName, SubmitErrorCode } from "@/lib/orders/checkout-state";
import { cn } from "@/lib/utils";
import { CartSkeleton, EmptyCart, LineImage, lineName, lineOptions, primaryButton } from "./cart-parts";
import { CheckoutField } from "./checkout-field";
import { OrderSuccessDialog } from "./order-success-dialog";

type Props = {
  locale: Locale;
  labels: { checkout: Dictionary["checkout"]; cart: Dictionary["cart"]; orderSuccess: Dictionary["orderSuccess"] };
  contact: { hotline: string; zaloUrl: string };
};

const initialState: CheckoutState = { status: "idle" };
const STOCK_ERRORS: SubmitErrorCode[] = ["OUT_OF_STOCK", "VARIANT_UNAVAILABLE", "VARIANT_NOT_FOUND"];

export function CheckoutView({ locale, labels, contact }: Props) {
  const { checkout: t, cart: tc, orderSuccess } = labels;
  const cart = useCartLines();
  const clear = useCartStore((s) => s.clear);
  const errorRef = useRef<HTMLDivElement>(null);
  // One key per visit to this page: sending the same order twice (double click, retry) creates it once.
  const idempotencyKey = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Details of a signed-in shopper (undefined while loading, null for a guest).
  const [defaults, setDefaults] = useState<CheckoutDefaults | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    loadCheckoutDefaults()
      .then((d) => !cancelled && setDefaults(d))
      .catch(() => !cancelled && setDefaults(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const [state, formAction, pending] = useActionState(
    async (previous: CheckoutState, formData: FormData): Promise<CheckoutState> => {
      idempotencyKey.current ??= crypto.randomUUID();
      formData.set("idempotencyKey", idempotencyKey.current);
      formData.set("locale", locale);
      // Only the ids and quantities leave the browser; the server looks up prices and names itself.
      formData.set("items", JSON.stringify(useCartStore.getState().items));

      const result = await submitOrderAction(previous, formData);
      if (result.status === "success") clear();
      // The cart data may be out of date (stock, availability): load it again so the shopper sees why.
      else if (result.status === "error" && STOCK_ERRORS.includes(result.error.code)) cart.retry();
      return result;
    },
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  // After a successful order the cart is cleared; keep showing the confirmation instead of an empty cart.
  if (state.status === "success") {
    return (
      <>
        <div className="rounded-lg bg-surface px-6 py-14 text-center shadow-soft" data-testid="order-sent">
          <h2 className="text-3xl font-medium">{orderSuccess.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{orderSuccess.text}</p>
          <p className="mt-6 text-xs tracking-wide text-muted-foreground uppercase">{orderSuccess.codeLabel}</p>
          <p className="font-heading text-3xl font-semibold tracking-wider tabular-nums">{state.code}</p>
          <Link href={localePath(locale, "/products")} className={cn(primaryButton, "mt-8")}>
            {orderSuccess.continue}
          </Link>
        </div>
        <OrderSuccessDialog
          code={state.code}
          labels={orderSuccess}
          hotline={contact.hotline}
          zaloUrl={contact.zaloUrl}
          productsHref={localePath(locale, "/products")}
          orderHref={defaults ? localePath(locale, `/account/orders/${state.code}`) : undefined}
        />
      </>
    );
  }

  if (cart.loading || defaults === undefined) return <CartSkeleton label={tc.loading} />;
  if (cart.error) {
    return (
      <div role="alert" className="rounded-lg bg-surface px-6 py-14 text-center shadow-soft">
        <p className="text-muted-foreground">{tc.loadError}</p>
        <button type="button" onClick={cart.retry} className={cn(primaryButton, "mt-5")}>
          {tc.retry}
        </button>
      </div>
    );
  }
  if (cart.empty) return <EmptyCart locale={locale} labels={tc} />;

  // A signed-in shopper starts with their details and default address filled in.
  const preferred = defaults?.addresses[0];
  const prefill: Partial<Record<FieldName, string>> = defaults
    ? {
        customerName: preferred?.recipientName ?? defaults.user.name ?? "",
        phone: preferred?.phone ?? defaults.user.phone ?? "",
        email: defaults.user.email,
        province: preferred?.province ?? "",
        district: preferred?.district ?? "",
        ward: preferred?.ward ?? "",
        street: preferred?.street ?? "",
      }
    : {};
  const values = state.status === "error" ? state.values : { ...prefill, ...(state.values ?? {}) };

  // Picking a saved address fills the address fields. The fields are plain inputs, so set them directly.
  const fillFromAddress = (addressId: string) => {
    const address = defaults?.addresses.find((a) => a.id === addressId);
    const form = formRef.current;
    if (!address || !form) return;
    const set = (name: string, value: string) => {
      const element = form.elements.namedItem(name);
      if (element instanceof HTMLInputElement) element.value = value;
    };
    set("customerName", address.recipientName);
    set("phone", address.phone);
    set("province", address.province);
    set("district", address.district);
    set("ward", address.ward);
    set("street", address.street);
  };
  const fieldErrors = state.status === "error" ? (state.error.fieldErrors ?? {}) : {};
  const error = (name: FieldName) => (fieldErrors[name] ? t.errors[fieldErrors[name]] : undefined);
  const value = (name: FieldName) => values[name] ?? "";
  const contactChoice = value("preferredContact") === "ZALO" ? "ZALO" : "PHONE";
  const lines = cart.rows.flatMap((r) => (r.kind === "line" ? [r] : []));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
      <form ref={formRef} action={formAction} noValidate aria-busy={pending} className="space-y-8">
        <p className="text-muted-foreground">{t.subtitle}</p>
        {defaults === null && (
          <p className="text-sm text-muted-foreground">
            {t.loginHint}{" "}
            <Link href={`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, "/checkout"))}`} className="font-medium text-foreground underline underline-offset-4">
              {t.loginLink}
            </Link>
          </p>
        )}

        {state.status === "error" && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-5 outline-none"
          >
            <p className="font-medium text-destructive">{t.formError.title}</p>
            <p className="mt-1 text-sm">{errorMessage(state.error, t, lines.map((r) => ({ id: r.line.variantId, name: lineName(r.line, locale) })))}</p>
            {STOCK_ERRORS.includes(state.error.code) && (
              <Link href={localePath(locale, "/cart")} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                {t.formError.reviewCart}
              </Link>
            )}
          </div>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-1 text-2xl font-medium">{t.sections.contact}</legend>
          <CheckoutField
            id="customerName"
            name="customerName"
            label={t.fields.customerName}
            defaultValue={value("customerName")}
            error={error("customerName")}
            autoComplete="name"
            maxLength={100}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckoutField
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              label={t.fields.phone}
              defaultValue={value("phone")}
              error={error("phone")}
              autoComplete="tel"
              maxLength={20}
              required
            />
            <CheckoutField
              id="email"
              name="email"
              type="email"
              label={t.fields.email}
              optionalLabel={t.optional}
              defaultValue={value("email")}
              error={error("email")}
              autoComplete="email"
              maxLength={200}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.fields.preferredContact}</legend>
            <div className="flex flex-wrap gap-2">
              {(["PHONE", "ZALO"] as const).map((choice) => (
                <label key={choice} className="relative">
                  <input
                    type="radio"
                    name="preferredContact"
                    value={choice}
                    defaultChecked={contactChoice === choice}
                    className="peer sr-only"
                  />
                  <span className="grid min-h-11 cursor-pointer place-items-center rounded-full border border-border bg-surface px-6 text-sm transition-colors duration-300 hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                    {choice === "PHONE" ? t.fields.contactPhone : t.fields.contactZalo}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-2xl font-medium">{t.sections.address}</legend>
          {defaults && defaults.addresses.length > 0 && (
            <div>
              <label htmlFor="savedAddress" className="mb-1.5 block text-sm font-medium">
                {t.savedAddresses}
              </label>
              {/* Not part of the order: it only fills the fields below. */}
              <select
                id="savedAddress"
                defaultValue=""
                onChange={(e) => e.target.value && fillFromAddress(e.target.value)}
                className="h-12 w-full rounded-sm border border-border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t.chooseAddress}</option>
                {defaults.addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.recipientName, a.street, a.district].join(" · ")}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <CheckoutField id="province" name="province" label={t.fields.province} defaultValue={value("province")} error={error("province")} autoComplete="address-level1" maxLength={100} required />
            <CheckoutField id="district" name="district" label={t.fields.district} defaultValue={value("district")} error={error("district")} autoComplete="address-level2" maxLength={100} required />
            <CheckoutField id="ward" name="ward" label={t.fields.ward} defaultValue={value("ward")} error={error("ward")} maxLength={100} required />
          </div>
          <CheckoutField id="street" name="street" label={t.fields.street} defaultValue={value("street")} error={error("street")} autoComplete="street-address" maxLength={200} required />
          {defaults && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" name="saveAddress" defaultChecked={defaults.addresses.length === 0} className="size-4 accent-gold" />
              {t.saveAddress}
            </label>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-2xl font-medium">{t.sections.note}</legend>
          <CheckoutField
            multiline
            id="customerNote"
            name="customerNote"
            label={t.fields.customerNote}
            optionalLabel={t.optional}
            defaultValue={value("customerNote")}
            error={error("customerNote")}
            maxLength={500}
          />
        </fieldset>

        {/* Trap for bots: invisible and unreachable for people, so only a script fills it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            {t.honeypot}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <div>
          <button type="submit" disabled={pending || cart.blocked} className={cn(primaryButton, "h-14 w-full text-base sm:w-auto sm:min-w-72")}>
            {pending ? t.submitting : t.submit}
          </button>
          <p className="mt-3 text-sm text-muted-foreground">{t.noPayment}</p>
          {cart.blocked && (
            <p role="status" className="mt-3 text-sm text-destructive">
              {tc.summary.blocked}{" "}
              <Link href={localePath(locale, "/cart")} className="font-medium underline underline-offset-4">
                {t.formError.reviewCart}
              </Link>
            </p>
          )}
        </div>
      </form>

      <aside aria-labelledby="checkout-summary-title" className="rounded-lg bg-surface p-6 shadow-soft lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="checkout-summary-title" className="text-2xl font-medium">
            {t.summaryTitle}
          </h2>
          <Link href={localePath(locale, "/cart")} className="text-sm underline underline-offset-4">
            {t.editCart}
          </Link>
        </div>
        <ul role="list" className="mt-4 divide-y divide-border">
          {lines.map(({ item, line, purchasable }) => (
            <li key={item.variantId} className={cn("flex gap-3 py-3", !purchasable && "opacity-50")}>
              <LineImage line={line} locale={locale} size="size-16" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{lineName(line, locale)}</p>
                {lineOptions(line, locale) && <p className="text-muted-foreground">{lineOptions(line, locale)}</p>}
                <p className="text-muted-foreground tabular-nums">
                  {item.quantity} × {formatVnd(line.unitPrice)}
                </p>
              </div>
              {purchasable && <p className="text-sm font-medium tabular-nums">{formatVnd(line.unitPrice * item.quantity)}</p>}
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{tc.summary.subtotal}</dt>
            <dd className="font-medium tabular-nums">{formatVnd(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{tc.summary.shipping}</dt>
            <dd className="text-right text-muted-foreground">{tc.summary.shippingNote}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <dt className="font-medium">{tc.summary.total}</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatVnd(cart.subtotal)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

/** The sentence for a failed submit, naming the cart line when the problem is about one. */
function errorMessage(
  error: Extract<CheckoutState, { status: "error" }>["error"],
  t: Dictionary["checkout"],
  lines: { id: string; name: string }[],
): string {
  const name = lines.find((l) => l.id === error.variantId)?.name ?? "";
  switch (error.code) {
    case "RATE_LIMITED":
      return format(t.formError.RATE_LIMITED, { minutes: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)) });
    case "OUT_OF_STOCK":
      return name ? format(t.formError.OUT_OF_STOCK, { name }) : t.formError.VARIANT_NOT_FOUND;
    case "VARIANT_UNAVAILABLE":
      return name ? format(t.formError.VARIANT_UNAVAILABLE, { name }) : t.formError.VARIANT_NOT_FOUND;
    default:
      return t.formError[error.code];
  }
}
