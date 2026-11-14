import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { siteConfig } from "@/lib/site-config";

// Foundation placeholder. Real storefront screens come from specs 001+ (docs/SPEC.md).
export default async function HomePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <header className="flex items-center justify-between px-[5vw] py-5">
        <span className="font-heading text-xl font-bold tracking-[0.22em]">
          {siteConfig.name.toUpperCase()}
        </span>
        <LanguageSwitcher
          current={locale}
          label={dict.language.label}
          names={{ vi: dict.language.vi, en: dict.language.en }}
        />
      </header>
      <main className="mx-[3vw] rounded-lg bg-dark px-[6vw] py-24 text-white shadow-lift">
        <p className="mb-6 text-xs tracking-[0.18em] text-gold-light uppercase">
          {dict.home.eyebrow}
        </p>
        <h1 className="max-w-2xl text-5xl leading-[1.05] font-medium md:text-7xl">
          {dict.home.title}
        </h1>
        <p className="mt-6 max-w-md text-white/70">{dict.home.subtitle}</p>
      </main>
    </>
  );
}
