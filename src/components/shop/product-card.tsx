import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { format, pick } from "@/i18n/format";
import { salePercent } from "@/lib/catalog/pricing";
import type { ProductCardData } from "@/lib/catalog/types";
import { Price } from "./price";

type Labels = { from: string; soldOut: string; sale: string; salePercent: string };

type Props = { product: ProductCardData; locale: Locale; labels: Labels; priority?: boolean };

export function ProductCard({ product, locale, labels, priority = false }: Props) {
  const name = pick(locale, product.nameVi, product.nameEn);
  const percent = salePercent(product.fromPrice, product.compareAtPrice);
  const colorNames = product.colors.map((c) => pick(locale, c.nameVi, c.nameEn)).join(", ");

  return (
    <li>
      <Link
        href={localePath(locale, `/products/${product.slug}`)}
        className="group block h-full rounded-md bg-surface p-3 pb-5 shadow-soft transition-[transform,box-shadow] duration-500 ease-soft hover:-translate-y-2 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-md)-6px)] bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)]">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={pick(locale, product.image.altVi, product.image.altEn) ?? name}
              fill
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
              priority={priority}
              className="object-contain p-[12%] transition-transform duration-700 ease-soft group-hover:scale-110 group-hover:-rotate-3"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted-foreground">
              <ImageOff className="size-8" aria-hidden />
            </span>
          )}
          {percent !== null && (
            <span className="absolute top-3 left-3 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white">
              {format(labels.salePercent, { percent })}
            </span>
          )}
          {!product.inStock && (
            <span className="absolute top-3 right-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {labels.soldOut}
            </span>
          )}
        </div>

        <p className="mt-4 px-2 text-xs tracking-wide text-muted-foreground uppercase">{product.brandName}</p>
        <h3 className="mt-0.5 px-2 font-sans text-[15px] leading-snug font-medium">{name}</h3>
        <div className="mt-2 flex items-center justify-between gap-2 px-2">
          <Price
            price={product.fromPrice}
            compareAtPrice={product.compareAtPrice}
            from={product.priceVaries}
            fromLabel={labels.from}
          />
          {product.colors.length > 0 && (
            <span className="flex shrink-0 gap-1">
              <span className="sr-only">{colorNames}</span>
              {product.colors.slice(0, 4).map((c) => (
                <span
                  key={c.nameVi}
                  aria-hidden
                  className="size-3.5 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: c.hex ?? "#ccc" }}
                />
              ))}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
