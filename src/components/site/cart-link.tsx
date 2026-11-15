"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCartCount } from "@/lib/cart/store";
import { format } from "@/i18n/format";

type Props = { href: string; label: string; labelWithCount: string };

export function CartLink({ href, label, labelWithCount }: Props) {
  const count = useCartCount();

  return (
    <Link
      href={href}
      aria-label={count > 0 ? format(labelWithCount, { count }) : label}
      className="relative inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <ShoppingBag className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span
          aria-hidden
          className="grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-xs font-semibold text-accent-foreground"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
