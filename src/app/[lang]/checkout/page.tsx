import type { Metadata } from "next";
import { CheckoutView } from "@/components/cart/checkout-view";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { siteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.checkout.title, robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto w-[min(1200px,92vw)] pt-10">
      <h1 className="mb-6 text-4xl font-medium sm:text-5xl">{dict.checkout.title}</h1>
      <CheckoutView
        locale={locale}
        labels={{ checkout: dict.checkout, cart: dict.cart, orderSuccess: dict.orderSuccess }}
        contact={{ hotline: siteConfig.hotline, zaloUrl: siteConfig.zaloUrl }}
      />
    </div>
  );
}
