import { ImageOff, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { pick } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CartLineData } from "@/lib/catalog/cart-lines";
import { cn } from "@/lib/utils";

export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** Name of a cart line in the current language. */
export const lineName = (line: CartLineData, locale: Locale) => pick(locale, line.nameVi, line.nameEn);

/** "Đen · 42", or an empty string for a product without options. */
export function lineOptions(line: CartLineData, locale: Locale): string {
  return [line.colorNameVi ? pick(locale, line.colorNameVi, line.colorNameEn) : null, line.sizeLabel].filter(Boolean).join(" · ");
}

export function LineImage({ line, locale, size }: { line: CartLineData; locale: Locale; size: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)]",
        size,
      )}
    >
      {line.image ? (
        <Image
          src={line.image.url}
          alt={pick(locale, line.image.altVi, line.image.altEn) ?? lineName(line, locale)}
          fill
          sizes="112px"
          className="object-contain p-2"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-muted-foreground">
          <ImageOff className="size-6" aria-hidden />
        </span>
      )}
    </span>
  );
}

export function EmptyCart({ locale, labels }: { locale: Locale; labels: Dictionary["cart"] }) {
  return (
    <div className="rounded-lg bg-surface px-6 py-16 text-center shadow-soft">
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
        <ShoppingBag className="size-6" aria-hidden />
      </span>
      <h2 className="text-2xl font-medium">{labels.empty.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{labels.empty.text}</p>
      <Link href={localePath(locale, "/products")} className={cn(primaryButton, "mt-6")}>
        {labels.empty.cta}
      </Link>
    </div>
  );
}

export function CartSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <span className="sr-only">{label}</span>
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} aria-hidden className="flex gap-4 rounded-md bg-surface p-5 shadow-soft">
            <div className="size-24 animate-pulse rounded-sm bg-secondary" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-20 animate-pulse rounded-full bg-secondary" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-secondary" />
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-secondary" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="h-64 animate-pulse rounded-lg bg-surface shadow-soft" />
    </div>
  );
}
