import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localePath } from "@/i18n/config";
import { siteConfig } from "@/lib/site-config";

export async function SiteFooter() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const link = "rounded-sm py-1 text-sm text-white/70 transition-colors duration-300 hover:text-white focus-visible:ring-2 focus-visible:ring-gold-light focus-visible:outline-none";

  return (
    <footer className="mt-24 rounded-t-lg bg-dark px-[5vw] pt-14 pb-8 text-white">
      <div className="mx-auto grid max-w-[1360px] gap-10 md:grid-cols-3">
        <div>
          <p className="font-heading text-2xl font-bold tracking-[0.22em]">{siteConfig.name.toUpperCase()}</p>
          <p className="mt-3 max-w-xs text-sm text-white/60">{dict.footer.tagline}</p>
        </div>
        <nav aria-label={dict.footer.shop} className="flex flex-col">
          <p className="mb-2 text-xs tracking-[0.18em] text-gold-light uppercase">{dict.footer.shop}</p>
          <Link href={localePath(locale, "/products?category=dong-ho")} className={link}>{dict.nav.watches}</Link>
          <Link href={localePath(locale, "/products?category=giay")} className={link}>{dict.nav.shoes}</Link>
          <Link href={localePath(locale, "/products")} className={link}>{dict.nav.all}</Link>
        </nav>
        <div className="flex flex-col">
          <p className="mb-2 text-xs tracking-[0.18em] text-gold-light uppercase">{dict.footer.support}</p>
          <a href={`tel:${siteConfig.hotline.replace(/\s/g, "")}`} className={link}>
            {dict.footer.hotline}: {siteConfig.hotline}
          </a>
          <a href={siteConfig.zaloUrl} target="_blank" rel="noopener noreferrer" className={link}>
            {dict.footer.zalo}
          </a>
          <p className="py-1 text-sm text-white/60">{dict.footer.address}</p>
          <p className="py-1 text-sm text-white/60">{dict.footer.hours}</p>
        </div>
      </div>
      <p className="mx-auto mt-12 flex max-w-[1360px] flex-wrap justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/50">
        <span>
          © {siteConfig.name}. {dict.footer.rights}
        </span>
        <span>{dict.footer.mockupNote}</span>
      </p>
    </footer>
  );
}
