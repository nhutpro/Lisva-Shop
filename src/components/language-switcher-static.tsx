import Link from "next/link";
import { locales, localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Switcher shown while the real one waits for the request URL (a Suspense fallback).
 * It has no hooks, so it can be prerendered; its links go to each language's home page.
 */
export function LanguageSwitcherStatic({
  current,
  label,
  names,
}: {
  current: Locale;
  label: string;
  names: Record<Locale, string>;
}) {
  return (
    <nav aria-label={label} className="flex rounded-full bg-background p-[3px] text-xs">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={localePath(locale)}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          title={names[locale]}
          className={cn(
            "rounded-full px-3 py-2 font-medium uppercase",
            locale === current ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
