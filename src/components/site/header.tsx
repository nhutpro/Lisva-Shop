import { Menu } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcherWithQuery } from "@/components/language-switcher";
import { LanguageSwitcherStatic } from "@/components/language-switcher-static";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localePath } from "@/i18n/config";
import { siteConfig } from "@/lib/site-config";
import { CartLink } from "./cart-link";
import { MobileMenu } from "./mobile-menu";
import { SearchForm } from "./search-form";

const navLink =
  "rounded-full px-4 py-2.5 text-[13.5px] font-medium transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export async function SiteHeader() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const names = { vi: dict.language.vi, en: dict.language.en };
  const links = [
    { href: localePath(locale, "/products?category=dong-ho"), label: dict.nav.watches },
    { href: localePath(locale, "/products?category=giay"), label: dict.nav.shoes },
    { href: localePath(locale, "/products"), label: dict.nav.all },
  ];
  const search = {
    locale,
    label: dict.search.label,
    placeholder: dict.search.placeholder,
    submit: dict.search.submit,
  };

  return (
    <header className="sticky top-3 z-50 mx-auto mt-3 flex w-[min(1200px,92vw)] items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 py-2 pr-2 pl-5 shadow-soft backdrop-blur-xl sm:pl-7">
      <Link
        href={localePath(locale)}
        className="font-heading text-xl font-bold tracking-[0.22em] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {siteConfig.name.toUpperCase()}
      </Link>

      <nav aria-label={dict.nav.primary} className="hidden items-center gap-1 lg:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={navLink}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <SearchForm id="search-header" {...search} className="hidden w-56 md:flex" />
        {/* These two read the current URL, which is only known at request time on dynamic routes (product pages). */}
        <Suspense fallback={<LanguageSwitcherStatic current={locale} label={dict.language.label} names={names} />}>
          <LanguageSwitcherWithQuery current={locale} label={dict.language.label} names={names} />
        </Suspense>
        <CartLink href={localePath(locale, "/cart")} label={dict.nav.cart} labelWithCount={dict.nav.cartCount} />
        <Suspense
          fallback={
            <button
              type="button"
              disabled
              aria-label={dict.common.menu}
              className="grid size-11 place-items-center rounded-full bg-background lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          }
        >
          <MobileMenu label={dict.common.menu} closeLabel={dict.common.closeMenu}>
            <SearchForm id="search-menu" {...search} className="mb-4 md:hidden" />
            <nav aria-label={dict.nav.primary} className="flex flex-col">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-sm px-3 py-3.5 text-base font-medium hover:bg-secondary">
                  {l.label}
                </Link>
              ))}
            </nav>
          </MobileMenu>
        </Suspense>
      </div>
    </header>
  );
}
