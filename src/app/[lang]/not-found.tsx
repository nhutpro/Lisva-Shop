import Link from "next/link";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto w-[min(640px,92vw)] py-24 text-center">
      <p className="font-heading text-7xl text-gold">404</p>
      <h1 className="mt-4 text-3xl font-medium">{dict.notFound.title}</h1>
      <p className="mt-3 text-muted-foreground">{dict.notFound.text}</p>
      <Link
        href={localePath(locale)}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {dict.notFound.back}
      </Link>
    </div>
  );
}
