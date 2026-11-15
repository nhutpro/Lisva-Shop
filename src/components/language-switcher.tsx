"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
  label: string;
  names: Record<Locale, string>;
  /** Keep the current query string (filters, search) when switching. Needs a Suspense boundary. */
  keepQuery?: boolean;
};

/** Reads the query string; render inside <Suspense> (it is a runtime value). */
export function LanguageSwitcherWithQuery(props: Omit<Props, "keepQuery">) {
  const search = useSearchParams().toString();
  return <LanguageSwitcher {...props} query={search ? `?${search}` : ""} />;
}

export function LanguageSwitcher({ current, label, names, query = "" }: Omit<Props, "keepQuery"> & { query?: string }) {
  const pathname = usePathname();
  // "/vi/products/x" -> "/products/x"
  const rest = pathname.replace(/^\/[^/]+/, "") || "";

  return (
    <nav aria-label={label} className="flex rounded-full bg-background p-[3px] text-xs">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}${rest}${query}`}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          title={names[locale]}
          className={cn(
            "rounded-full px-3 py-2 font-medium uppercase transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            locale === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
