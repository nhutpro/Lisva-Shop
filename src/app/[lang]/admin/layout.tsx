import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav, AccountNavStatic } from "@/components/account/account-nav";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.title, robots: { index: false, follow: false } };
}

// The layout only draws the frame and the tabs. Who may see the content is decided by every page and action,
// inside <Suspense>, with requireAdmin().
export default async function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.admin;
  const items = [
    { href: localePath(locale, "/admin"), label: t.nav.overview },
    { href: localePath(locale, "/admin/orders"), label: t.nav.orders },
    { href: localePath(locale, "/admin/products"), label: t.nav.products },
    { href: localePath(locale, "/admin/catalog"), label: t.nav.catalog },
  ];

  return (
    <div className="mx-auto w-[min(1280px,94vw)] pt-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-4xl font-medium sm:text-5xl">{t.title}</h1>
        <Link href={localePath(locale)} className="text-sm underline underline-offset-4">
          {t.nav.shop}
        </Link>
      </div>
      <Suspense fallback={<AccountNavStatic items={items} label={t.nav.label} />}>
        <AccountNav items={items} label={t.nav.label} />
      </Suspense>
      <div className="mt-6">{children}</div>
    </div>
  );
}
