"use client";

import { Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useCartStore } from "@/lib/cart/store";
import { maxQuantityFor, useCartLines, type CartRow } from "@/lib/cart/use-cart-lines";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartSkeleton, EmptyCart, LineImage, lineName, lineOptions, primaryButton } from "./cart-parts";

type Props = { locale: Locale; labels: Dictionary["cart"] };

const iconButton =
  "grid size-11 place-items-center rounded-full border border-border bg-surface transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border";

export function CartView({ locale, labels }: Props) {
  const cart = useCartLines();

  if (cart.loading) return <CartSkeleton label={labels.loading} />;

  if (cart.error) {
    return (
      <div role="alert" className="rounded-lg bg-surface px-6 py-14 text-center shadow-soft">
        <p className="text-muted-foreground">{labels.loadError}</p>
        <button type="button" onClick={cart.retry} className={cn(primaryButton, "mt-5")}>
          {labels.retry}
        </button>
      </div>
    );
  }

  if (cart.empty) return <EmptyCart locale={locale} labels={labels} />;

  const pieces = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px] lg:gap-10">
      <section aria-label={labels.title}>
        <p aria-live="polite" className="mb-4 text-muted-foreground">
          {format(labels.itemCount, { count: pieces })}
        </p>
        <ul role="list" className="space-y-4">
          {cart.rows.map((row) => (
            <CartLineItem key={row.item.variantId} row={row} locale={locale} labels={labels} />
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="cart-summary-title"
        className="rounded-lg bg-surface p-6 shadow-soft lg:sticky lg:top-24"
      >
        <h2 id="cart-summary-title" className="text-2xl font-medium">
          {labels.summary.title}
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{labels.summary.subtotal}</dt>
            <dd className="font-medium tabular-nums">{formatVnd(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{labels.summary.shipping}</dt>
            <dd className="text-right text-muted-foreground">{labels.summary.shippingNote}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <dt className="font-medium">{labels.summary.total}</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatVnd(cart.subtotal)}</dd>
          </div>
        </dl>

        {cart.blocked ? (
          <>
            <button type="button" disabled className={cn(primaryButton, "mt-6 w-full")}>
              {labels.summary.checkout}
            </button>
            <p role="status" className="mt-3 text-sm text-destructive">
              {labels.summary.blocked}
            </p>
          </>
        ) : (
          <Link href={localePath(locale, "/checkout")} className={cn(primaryButton, "mt-6 w-full")}>
            {labels.summary.checkout}
          </Link>
        )}
        <Link
          href={localePath(locale, "/products")}
          className="mt-3 block rounded-sm py-2 text-center text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labels.summary.continueShopping}
        </Link>
      </aside>
    </div>
  );
}

function CartLineItem({ row, locale, labels }: { row: CartRow; locale: Locale; labels: Dictionary["cart"] }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);

  // The variant is gone from the shop: nothing to show except a way to remove it.
  if (row.kind === "missing") {
    return (
      <li className="rounded-md border border-destructive/30 bg-surface p-5">
        <Unavailable labels={labels} onRemove={() => remove(row.item.variantId)} removeLabel={labels.line.removeUnavailable} />
      </li>
    );
  }

  const { item, line, purchasable, adjustedTo } = row;
  const name = lineName(line, locale);
  const options = lineOptions(line, locale);
  const max = maxQuantityFor(line);
  const href = localePath(locale, `/products/${line.productSlug}`);

  return (
    <li className={cn("rounded-md bg-surface p-4 shadow-soft sm:p-5", !purchasable && "border border-destructive/30")}>
      <div className="flex gap-4">
        <Link href={href} tabIndex={-1} aria-hidden>
          <LineImage line={line} locale={locale} size="size-24 sm:size-28" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{line.brandName}</p>
          <Link href={href} className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {name}
          </Link>
          {options && <p className="mt-0.5 text-sm text-muted-foreground">{options}</p>}
          <p className="mt-2 text-sm tabular-nums">
            <span className="sr-only">{labels.line.unitPrice}: </span>
            {formatVnd(line.unitPrice)}
          </p>
          {purchasable && line.stock <= 5 && (
            <p className="mt-1 text-sm text-destructive">{format(labels.line.lowStock, { count: line.stock })}</p>
          )}
          {adjustedTo !== null && (
            <p role="status" className="mt-1 text-sm text-destructive">
              {format(labels.line.stockAdjusted, { count: adjustedTo })}
            </p>
          )}
        </div>
      </div>

      {purchasable ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={format(labels.line.quantity, { name })} className="flex items-center gap-2">
            <button
              type="button"
              aria-label={format(labels.line.decrease, { name })}
              disabled={item.quantity <= 1}
              onClick={() => setQuantity(item.variantId, item.quantity - 1)}
              className={iconButton}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <output aria-live="polite" className="min-w-8 text-center font-medium tabular-nums">
              {item.quantity}
            </output>
            <button
              type="button"
              aria-label={format(labels.line.increase, { name })}
              title={item.quantity >= max ? labels.line.maxReached : undefined}
              disabled={item.quantity >= max}
              onClick={() => setQuantity(item.variantId, item.quantity + 1)}
              className={iconButton}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <p className="ml-auto font-semibold tabular-nums">
            <span className="sr-only">{labels.line.lineTotal}: </span>
            {formatVnd(line.unitPrice * item.quantity)}
          </p>
          <RemoveButton label={format(labels.line.remove, { name })} onClick={() => remove(item.variantId)} />
        </div>
      ) : (
        <div className="mt-4">
          <Unavailable labels={labels} onRemove={() => remove(item.variantId)} removeLabel={format(labels.line.remove, { name })} />
        </div>
      )}
    </li>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={iconButton}>
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

function Unavailable({ labels, onRemove, removeLabel }: { labels: Dictionary["cart"]; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex items-start gap-3 rounded-sm bg-destructive/5 p-4">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-destructive">{labels.unavailable.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{labels.unavailable.text}</p>
      </div>
      <RemoveButton label={removeLabel} onClick={onRemove} />
    </div>
  );
}
