import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.cart.title, robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto w-[min(1200px,92vw)] pt-10">
      <h1 className="mb-2 text-4xl font-medium sm:text-5xl">{dict.cart.title}</h1>
      <CartView locale={locale} labels={dict.cart} />
    </div>
  );
}
