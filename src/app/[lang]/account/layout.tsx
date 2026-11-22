import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountNav, AccountNavStatic } from "@/components/account/account-nav";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.account.title, robots: { index: false, follow: false } };
}

// The layout only draws the frame and the tabs. Who is signed in is checked by each page, inside <Suspense>.
export default async function AccountLayout({ children }: LayoutProps<"/[lang]/account">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const items = [
    { href: localePath(locale, "/account"), label: dict.auth.account.profile },
    { href: localePath(locale, "/account/addresses"), label: dict.auth.account.addresses },
    { href: localePath(locale, "/account/orders"), label: dict.auth.account.orders },
  ];
  const label = dict.auth.account.navLabel;

  return (
    <div className="mx-auto w-[min(1100px,92vw)] pt-10">
      <h1 className="mb-6 text-4xl font-medium sm:text-5xl">{dict.auth.account.title}</h1>
      <Suspense fallback={<AccountNavStatic items={items} label={label} />}>
        <AccountNav items={items} label={label} />
      </Suspense>
      <div className="mt-8">{children}</div>
    </div>
  );
}
