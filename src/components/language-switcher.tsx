"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
  label: string;
  names: Record<Locale, string>;
};

export function LanguageSwitcher({ current, label, names }: Props) {
  const pathname = usePathname();
  // "/vi/products/x" -> "/products/x"
  const rest = pathname.replace(/^\/[^/]+/, "") || "";

  return (
    <nav
      aria-label={label}
      className="flex rounded-full bg-background p-[3px] text-xs"
    >
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}${rest}`}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          title={names[locale]}
          className={cn(
            "rounded-full px-3 py-1.5 font-medium uppercase transition-colors duration-300",
            locale === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
