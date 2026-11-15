import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CategoryArt } from "@/components/shop/art";
import { HeroWatch } from "@/components/shop/hero-watch";
import { ProductGrid } from "@/components/shop/product-grid";
import { TrustRow } from "@/components/shop/trust-row";
import { Button } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { format, pick } from "@/i18n/format";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getHomeData } from "@/lib/catalog/queries";

export default async function HomePage() {
  const [dict, locale, home] = await Promise.all([getDictionary(), getLocale(), getHomeData()]);
  const topCategories = home.categories.filter((c) => c.parentSlug === null);
  const productsPath = localePath(locale, "/products");

  return (
    <div className="space-y-24 pb-4">
      {/* Hero */}
      <section className="relative mx-[3vw] mt-6 grid min-h-[560px] items-center overflow-hidden rounded-lg bg-dark text-white shadow-lift lg:grid-cols-[1.1fr_1fr]">
        <div
          aria-hidden
          className="animate-glow pointer-events-none absolute top-1/2 right-[6%] size-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(217_188_132/0.28),transparent_65%)] blur-[10px]"
        />
        <div className="relative z-10 px-7 py-14 sm:px-[6vw] lg:py-24">
          <p className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-gold-light/40 px-4 py-1.5 text-xs tracking-[0.18em] text-gold-light uppercase">
            {dict.home.eyebrow}
          </p>
          <h1 className="animate-fade-up max-w-xl text-[clamp(2.4rem,5.4vw,4.75rem)] leading-[1.05] font-medium [animation-delay:100ms]">
            {dict.home.title}
          </h1>
          <p className="animate-fade-up mt-6 max-w-md text-white/70 [animation-delay:200ms]">{dict.home.subtitle}</p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:300ms]">
            <Button
              size="lg"
              render={<Link href={productsPath} />}
              nativeButton={false}
              className="h-12 bg-gradient-to-br from-gold-light to-gold px-7 text-sm text-accent-foreground hover:brightness-110"
            >
              {dict.home.cta}
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href={`${productsPath}?category=giay`} />}
              nativeButton={false}
              className="h-12 border-white/35 bg-white/10 px-7 text-sm text-white hover:bg-white/20 hover:text-white"
            >
              {dict.home.ctaSecondary}
            </Button>
          </div>
          <dl className="animate-fade-up mt-12 flex gap-8 border-t border-white/12 pt-6 [animation-delay:400ms]">
            {[
              [dict.home.statGenuineValue, dict.home.statGenuine],
              [dict.home.statWarrantyValue, dict.home.statWarranty],
              [dict.home.statReturnsValue, dict.home.statReturns],
            ].map(([value, label]) => (
              <div key={label}>
                <dd className="font-heading text-2xl text-gold-light">{value}</dd>
                <dt className="text-xs text-white/55">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative z-10 grid place-items-center px-6 pb-10 lg:py-10">
          <HeroWatch className="animate-float w-[min(380px,70vw)] drop-shadow-[0_40px_50px_rgba(0,0,0,0.55)]" />
        </div>
      </section>

      {/* Categories */}
      {topCategories.length > 0 && (
        <section aria-labelledby="home-categories" className="mx-auto w-[min(1360px,92vw)]">
          <h2 id="home-categories" className="reveal mb-8 text-3xl font-medium sm:text-4xl">
            {dict.home.categoriesTitle}
          </h2>
          <ul role="list" className="grid gap-5 md:grid-cols-2">
            {topCategories.map((c, i) => (
              <li key={c.slug} className="reveal">
                <Link
                  href={`${productsPath}?category=${c.slug}`}
                  className={`group relative flex h-[340px] flex-col justify-end overflow-hidden rounded-lg p-8 shadow-soft transition-[transform,box-shadow] duration-500 ease-soft hover:-translate-y-1.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none ${
                    i % 2 === 0 ? "bg-gradient-to-br from-[#ece8df] to-[#dcd6c9]" : "bg-gradient-to-br from-[#e3dfd5] to-[#cfc8b8]"
                  }`}
                >
                  <CategoryArt
                    slug={c.slug}
                    className="absolute top-1/2 right-[8%] w-[42%] -translate-y-[55%] transition-transform duration-700 ease-soft group-hover:-translate-y-[58%] group-hover:scale-110 group-hover:-rotate-3"
                  />
                  <h3 className="relative text-3xl font-medium">{pick(locale, c.nameVi, c.nameEn)}</h3>
                  <p className="relative mt-1 mb-5 text-sm text-muted-foreground">
                    {format(dict.home.categoryCount, { count: c.count })}
                  </p>
                  <span className="relative inline-flex w-max items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-500 group-hover:bg-gold group-hover:text-accent-foreground">
                    {dict.home.categoryLink}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Featured */}
      {home.featured.length > 0 && (
        <section aria-labelledby="home-featured" className="mx-auto w-[min(1360px,92vw)]">
          <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="home-featured" className="text-3xl font-medium sm:text-4xl">
                {dict.home.featuredTitle}
              </h2>
              <p className="mt-1 text-muted-foreground">{dict.home.featuredSubtitle}</p>
            </div>
            <Link href={productsPath} className="text-sm font-medium underline-offset-4 hover:underline">
              {dict.common.viewAll}
            </Link>
          </div>
          <ProductGrid products={home.featured} locale={locale} dict={dict} />
        </section>
      )}

      {/* Newest */}
      {home.newest.length > 0 && (
        <section aria-labelledby="home-newest" className="mx-auto w-[min(1360px,92vw)]">
          <div className="reveal mb-8">
            <h2 id="home-newest" className="text-3xl font-medium sm:text-4xl">
              {dict.home.newestTitle}
            </h2>
            <p className="mt-1 text-muted-foreground">{dict.home.newestSubtitle}</p>
          </div>
          <ProductGrid products={home.newest} locale={locale} dict={dict} />
        </section>
      )}

      <section aria-label={dict.trust.genuineTitle} className="mx-auto w-[min(1360px,92vw)]">
        <TrustRow dict={dict} />
      </section>
    </div>
  );
}
