"use client";

import { Check, ImageOff, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { format, pick } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useCartStore } from "@/lib/cart/store";
import { salePercent } from "@/lib/catalog/pricing";
import type { ProductDetailData } from "@/lib/catalog/types";
import {
  displayPrice,
  galleryImages,
  initialSelection,
  missingOptions,
  optionAvailability,
  resolveVariant,
  selectOption,
  sizesForColor,
  stockState,
  type Selection,
} from "@/lib/catalog/variant-selection";
import { cn } from "@/lib/utils";
import { Price } from "./price";

type Props = {
  product: ProductDetailData;
  locale: Locale;
  cartHref: string;
  /** Translated strings (plain object, passed from the server). */
  labels: Dictionary["product"];
  fromLabel: string;
};

const optionBase =
  "grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-sm border border-border bg-surface px-3 text-sm transition-colors duration-300 hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:border-dashed peer-disabled:text-muted-foreground peer-disabled:line-through peer-disabled:hover:border-border";

export function ProductPurchase({
  product,
  locale,
  cartHref,
  labels,
  fromLabel,
}: Props) {
  const options = { colors: product.colors, sizes: product.sizes };
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(product.variants, options),
  );
  const [added, setAdded] = useState<{ sku: string } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [thumb, setThumb] = useState<{ key: string; index: number }>({
    key: "",
    index: 0,
  });
  const addToCart = useCartStore((s) => s.add);

  const name = pick(locale, product.nameVi, product.nameEn);
  const variant = resolveVariant(product.variants, options, selection);
  const selectedColor = product.colors.find((c) => c.id === selection.colorId);
  const missing = missingOptions(options, selection);
  const images = galleryImages(product.images, selection, variant);
  const imagesKey = images.map((i) => i.id).join("|");
  const activeIndex =
    thumb.key === imagesKey ? Math.min(thumb.index, images.length - 1) : 0;
  const active = images[activeIndex];

  const { price, from } = displayPrice(
    product.variants,
    variant,
    product.price,
  );
  const percent = salePercent(price, product.compareAtPrice);
  const allSoldOut = product.variants.every((v) => v.stock <= 0);
  const state = variant ? stockState(variant.stock) : null;
  const soldOut = variant ? variant.stock <= 0 : allSoldOut;

  const choose = (axis: "color" | "size", id: string) => {
    setSelection((s) => selectOption(product.variants, s, axis, id));
    setAdded(null);
    setWarning(null);
  };

  const submit = () => {
    if (missing.length > 0) {
      setAdded(null);
      setWarning(
        missing.length === 2
          ? labels.chooseBoth
          : missing[0] === "color"
            ? labels.chooseColor
            : labels.chooseSize,
      );
      return;
    }
    if (!variant) {
      setAdded(null);
      setWarning(labels.unavailableCombination);
      return;
    }
    if (variant.stock <= 0) return;
    addToCart(variant.id, 1);
    setWarning(null);
    setAdded({ sku: variant.sku });
  };

  const stockText =
    state === "sold-out"
      ? labels.soldOut
      : state === "low"
        ? format(labels.lowStock, { count: variant?.stock ?? 0 })
        : state === "in-stock"
          ? labels.inStock
          : allSoldOut
            ? labels.soldOut
            : null;

  const hasGuide = product.sizes.some((s) => s.footLengthCm !== null);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      {/* Gallery */}
      <div
        className="lg:sticky lg:top-24 lg:self-start"
        role="group"
        aria-label={labels.gallery}
      >
        <div className="relative aspect-square overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)] shadow-soft">
          {active ? (
            <Image
              key={active.id}
              src={active.url}
              alt={pick(locale, active.altVi, active.altEn) ?? name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 92vw"
              className="object-contain p-[10%]"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted-foreground">
              <ImageOff className="size-10" aria-hidden />
            </span>
          )}
          {percent !== null && (
            <span className="absolute top-4 left-4 rounded-full bg-destructive px-3.5 py-1.5 text-sm font-semibold text-white">
              {format(labels.sale, { percent })}
            </span>
          )}
        </div>
        {images.length > 1 && (
          <ul role="list" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <li key={img.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setThumb({ key: imagesKey, index: i })}
                  aria-label={format(labels.selectedPhoto, {
                    n: i + 1,
                    total: images.length,
                  })}
                  aria-current={i === activeIndex ? "true" : undefined}
                  className={cn(
                    "relative block size-16 overflow-hidden rounded-sm border bg-surface transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-20",
                    i === activeIndex
                      ? "border-primary"
                      : "border-border hover:border-primary",
                  )}
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-contain p-1.5"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Details */}
      <div>
        <p className="text-sm tracking-wide text-muted-foreground uppercase">
          {product.brandName}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-medium sm:text-4xl">
          {name}
        </h1>
        <Price
          price={price}
          compareAtPrice={product.compareAtPrice}
          from={from}
          fromLabel={fromLabel}
          className="mt-4 text-2xl"
        />

        <div className="mt-6 space-y-6">
          {product.colors.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium">
                {labels.color}
                {selectedColor && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {pick(locale, selectedColor.nameVi, selectedColor.nameEn)}
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => {
                  const a = optionAvailability(
                    product.variants,
                    "color",
                    c.id,
                    selection,
                  );
                  const disabled = !a.reachable; // choosing a color moves the size, so only its own stock matters
                  const colorName = pick(locale, c.nameVi, c.nameEn);
                  return (
                    <label key={c.id} className="relative">
                      <input
                        type="radio"
                        name="color"
                        value={c.id}
                        checked={selection.colorId === c.id}
                        disabled={disabled}
                        onChange={() => choose("color", c.id)}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          optionBase,
                          "gap-2 px-4 [grid-auto-flow:column]",
                        )}
                      >
                        <span
                          aria-hidden
                          className="size-4 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: c.hex ?? "#ccc" }}
                        />
                        {colorName}
                        {disabled && (
                          <span className="sr-only">
                            {" "}
                            (
                            {a.exists
                              ? labels.optionSoldOut
                              : labels.optionUnavailable}
                            )
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {product.sizes.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium">
                {labels.size}
              </legend>
              <div className="flex flex-wrap gap-2">
                {sizesForColor(
                  product.variants,
                  options,
                  selection.colorId,
                ).map((s) => {
                  const a = optionAvailability(
                    product.variants,
                    "size",
                    s.id,
                    selection,
                  );
                  const disabled = !a.exists || !a.inStock;
                  return (
                    <label key={s.id} className="relative">
                      <input
                        type="radio"
                        name="size"
                        value={s.id}
                        checked={selection.sizeId === s.id}
                        disabled={disabled}
                        onChange={() => choose("size", s.id)}
                        className="peer sr-only"
                      />
                      <span className={optionBase}>
                        {s.label}
                        {disabled && (
                          <span className="sr-only">
                            {" "}
                            (
                            {a.exists
                              ? labels.optionSoldOut
                              : labels.optionUnavailable}
                            )
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {hasGuide && (
                <details className="mt-4 rounded-sm border border-border bg-surface">
                  <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
                    {labels.sizeGuide.title}
                  </summary>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full text-left text-sm tabular-nums">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            {labels.sizeGuide.size}
                          </th>
                          <th scope="col" className="py-2 pr-4 font-medium">
                            {labels.sizeGuide.foot}
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            {labels.sizeGuide.us}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.sizes.map((s) => (
                          <tr key={s.id} className="border-t border-border">
                            <th scope="row" className="py-2 pr-4 font-medium">
                              {s.label}
                            </th>
                            <td className="py-2 pr-4">
                              {s.footLengthCm ?? "–"}
                            </td>
                            <td className="py-2">{s.usSize ?? "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </fieldset>
          )}
        </div>

        <div className="mt-6 min-h-12 text-sm" aria-live="polite">
          {stockText && (
            <p
              className={cn(
                "flex items-center gap-2",
                state === "low" && "text-destructive",
                soldOut && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  soldOut
                    ? "bg-muted-foreground"
                    : state === "low"
                      ? "bg-destructive"
                      : "bg-green-600",
                )}
              />
              {stockText}
              {variant && (
                <span className="ml-2 text-muted-foreground">
                  {labels.sku}: {variant.sku}
                </span>
              )}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {labels.stockNote}
          </p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={soldOut}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold text-[15px] font-semibold text-accent-foreground transition-[transform,box-shadow,filter] duration-500 ease-soft hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-8px_rgb(176_141_87/0.7)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-secondary disabled:to-secondary disabled:text-muted-foreground disabled:shadow-none"
        >
          <ShoppingBag className="size-5" aria-hidden />
          {soldOut ? labels.soldOutButton : labels.addToCart}
        </button>

        <div role="status" aria-live="polite" className="mt-3 min-h-6 text-sm">
          {warning && <p className="text-destructive">{warning}</p>}
          {added && (
            <p className="flex flex-wrap items-center gap-x-3 text-green-700">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4" aria-hidden />
                {labels.added}
              </span>
              <Link
                href={cartHref}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {labels.viewCart}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
