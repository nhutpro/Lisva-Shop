import Link from "next/link";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { Card, ghostButton } from "@/components/admin/admin-ui";
import { BrandForm, CategoryForm, DeleteRow, SizeForm } from "@/components/admin/catalog-forms";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { listBrands, listCategories, listSizes } from "@/lib/admin/reference-data";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export default async function CatalogPage({ searchParams }: PageProps<"/[lang]/admin/catalog">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <CatalogContent searchParams={searchParams} locale={locale} dict={dict} />
    </Suspense>
  );
}

const KINDS = ["brand", "category", "size"] as const;

async function CatalogContent({
  searchParams,
  locale,
  dict,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  locale: Locale;
  dict: Dictionary;
}) {
  await requireAdmin();
  const [brands, categories, sizes] = await Promise.all([listBrands(db), listCategories(db), listSizes(db)]);
  const raw = await searchParams;
  const t = dict.admin.catalog;
  const base = localePath(locale, "/admin/catalog");

  // ?new=brand, or ?edit=brand:<id>
  const newKind = KINDS.find((k) => k === raw.new);
  const [editKind, editId] = (typeof raw.edit === "string" ? raw.edit : "").split(":");
  const editing = KINDS.find((k) => k === editKind);

  const panel = () => {
    if (newKind === "brand" || (editing === "brand" && brands.some((b) => b.id === editId))) {
      return <BrandForm key={editId ?? "new"} dict={dict} backHref={base} brand={brands.find((b) => b.id === editId)} />;
    }
    if (newKind === "category" || (editing === "category" && categories.some((c) => c.id === editId))) {
      return <CategoryForm key={editId ?? "new"} dict={dict} backHref={base} category={categories.find((c) => c.id === editId)} categories={categories} />;
    }
    if (newKind === "size" || (editing === "size" && sizes.some((s) => s.id === editId))) {
      return <SizeForm key={editId ?? "new"} dict={dict} backHref={base} size={sizes.find((s) => s.id === editId)} />;
    }
    return null;
  };
  const form = panel();
  const row = "flex flex-wrap items-center justify-between gap-3 py-3";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t.intro}</p>

        <Card title={t.brands} id="brands" action={<Link href={`${base}?new=brand`} className={ghostButton}>{t.addBrand}</Link>}>
          {brands.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyBrands}</p> : (
            <ul role="list" className="divide-y divide-border">
              {brands.map((b) => (
                <li key={b.id} className={row}>
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-sm text-muted-foreground">{b.skuPrefix} · {b.slug} · {format(t.productCount, { count: b.productCount })}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Link href={`${base}?edit=brand:${b.id}`} className={ghostButton}>{dict.admin.common.edit}</Link>
                    <DeleteRow kind="brand" id={b.id} dict={dict} label={`${dict.admin.common.delete} ${b.name}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.categories} id="categories" action={<Link href={`${base}?new=category`} className={ghostButton}>{t.addCategory}</Link>}>
          {categories.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyCategories}</p> : (
            <ul role="list" className="divide-y divide-border">
              {categories.filter((c) => !c.parentId).flatMap((c) => [c, ...categories.filter((x) => x.parentId === c.id)]).map((c) => (
                <li key={c.id} className={row}>
                  <div className={c.parentId ? "pl-6" : undefined}>
                    <p className="font-medium">{c.parentId ? "↳ " : ""}{c.nameVi}{c.nameEn ? ` / ${c.nameEn}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{c.slug} · {format(t.productCount, { count: c.productCount })}{c.childCount > 0 ? ` · ${format(t.subCount, { count: c.childCount })}` : ""}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Link href={`${base}?edit=category:${c.id}`} className={ghostButton}>{dict.admin.common.edit}</Link>
                    <DeleteRow kind="category" id={c.id} dict={dict} label={`${dict.admin.common.delete} ${c.nameVi}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.sizes} id="sizes" action={<Link href={`${base}?new=size`} className={ghostButton}>{t.addSize}</Link>}>
          {sizes.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptySizes}</p> : (
            <ul role="list" className="divide-y divide-border">
              {sizes.map((s) => (
                <li key={s.id} className={row}>
                  <div>
                    <p className="font-medium">{t.types[s.type]} · {s.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {[s.footLengthCm !== null ? `${s.footLengthCm} cm` : null, s.usSize ? `US ${s.usSize}` : null, format(t.variantCount, { count: s.variantCount })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Link href={`${base}?edit=size:${s.id}`} className={ghostButton}>{dict.admin.common.edit}</Link>
                    <DeleteRow kind="size" id={s.id} dict={dict} label={`${dict.admin.common.delete} ${s.label}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {form && <div className="lg:sticky lg:top-24"><Card>{form}</Card></div>}
    </div>
  );
}
