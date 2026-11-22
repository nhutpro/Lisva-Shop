"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string };

const base =
  "inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Tabs of the account area; the current one is highlighted. Reads the URL, so render inside <Suspense>. */
export function AccountNav({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname();
  // The first item (profile) is exact; the others also match their sub-pages.
  const isCurrent = (href: string, index: number) => (index === 0 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(item.href, i) ? "page" : undefined}
          className={cn(base, isCurrent(item.href, i) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Same tabs without the highlight, shown while the real ones wait for the URL (a Suspense fallback). */
export function AccountNavStatic({ items, label }: { items: Item[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={cn(base, "border-border bg-surface")}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
