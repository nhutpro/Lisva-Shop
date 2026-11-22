import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import {
  Pager,
  SelectField,
  TextField,
  button,
  ghostButton,
} from "@/components/admin/admin-ui";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import {
  getDictionary,
  getLocale,
  type Dictionary,
} from "@/i18n/get-dictionary";
import { listAdminProducts } from "@/lib/admin/products";
import { listCategories } from "@/lib/admin/reference-data";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const tone = {
  DRAFT: "bg-secondary text-foreground",
  ACTIVE: "bg-green-600/10 text-green-800",
  ARCHIVED: "bg-destructive/10 text-destructive",
} as const;

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/[lang]/admin/products">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <ProductsContent
        searchParams={searchParams}
        locale={locale}
        dict={dict}
      />
    </Suspense>
  );
}

async function ProductsContent({
  searchParams,
  locale,
  dict,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  locale: Locale;
  dict: Dictionary;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;

  const q = one(raw.q)?.trim().slice(0, 80) || undefined;
  const status = STATUSES.find((s) => s === one(raw.status));
  const categoryId = one(raw.category) || undefined;
  const [list, categories] = await Promise.all([
    listAdminProducts(db, {
      q,
      status,
      categoryId,
      page: Number(one(raw.page)) || 1,
    }),
    listCategories(db),
  ]);

  const t = dict.admin;
  const base = localePath(locale, "/admin/products");
  const top = categories.filter((c) => !c.parentId);

  return (
    <div>
      <h2 className="sr-only">{t.products.title}</h2>
      <div className="mb-5 flex justify-end">
        <Link
          href={localePath(locale, "/admin/products/new")}
          className={button}
        >
          {t.products.new}
        </Link>
      </div>

      <form
        action={base}
        method="get"
        role="search"
        className="mb-6 grid items-end gap-3 rounded-lg bg-surface p-4 shadow-soft sm:grid-cols-[1fr_200px_220px_auto] sm:p-5"
      >
        <TextField
          id="products-q"
          name="q"
          type="search"
          label={t.products.searchLabel}
          placeholder={t.products.searchPlaceholder}
          defaultValue={q}
          maxLength={80}
        />
        <SelectField
          id="products-status"
          name="status"
          label={t.products.status}
          defaultValue={status ?? ""}
        >
          <option value="">{t.common.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.products.statusLabels[s]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="products-category"
          name="category"
          label={t.products.category}
          defaultValue={categoryId ?? ""}
        >
          <option value="">{t.common.all}</option>
          {top.map((c) => [
            <option key={c.id} value={c.id}>
              {c.nameVi}
            </option>,
            ...categories
              .filter((x) => x.parentId === c.id)
              .map((child) => (
                <option
                  key={child.id}
                  value={child.id}
                >{`${c.nameVi} › ${child.nameVi}`}</option>
              )),
          ])}
        </SelectField>
        <div className="flex gap-2">
          <button type="submit" className={button}>
            {t.common.apply}
          </button>
          <Link href={base} className={ghostButton}>
            {t.common.reset}
          </Link>
        </div>
      </form>

      <p aria-live="polite" className="mb-3 text-sm text-muted-foreground">
        {format(t.common.results, { count: list.total })}
      </p>
      {list.items.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-muted-foreground shadow-soft">
          {t.products.empty}
        </p>
      ) : (
        <ul role="list" className="space-y-3">
          {list.items.map((p) => (
            <li key={p.id} className="rounded-md bg-surface shadow-soft">
              <Link
                href={`${base}/${p.id}`}
                aria-label={format(t.products.edit, { name: p.nameVi })}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md p-4 transition-colors duration-300 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="relative block size-16 shrink-0 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)]">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                      <ImageOff className="size-5" aria-hidden />
                    </span>
                  )}
                </span>
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{p.nameVi}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.brandName} · {p.categoryName}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    tone[p.status],
                  )}
                >
                  {t.products.statusLabels[p.status]}
                </span>
                <div className="min-w-28 text-sm">
                  <p className="tabular-nums">
                    {t.products.stock}:{" "}
                    <span className="font-medium">{p.totalStock}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {format(t.products.variants, { count: p.variantCount })}
                  </p>
                </div>
                {p.lowStock && (
                  <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                    {t.products.lowStock}
                  </span>
                )}
                <p className="ml-auto font-semibold tabular-nums">
                  {formatVnd(p.price)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager
        base={base}
        params={{ q, status, category: categoryId }}
        page={list.page}
        pageCount={list.pageCount}
        labels={{
          previous: t.common.previous,
          next: t.common.next,
          page: format(t.common.page, {
            page: list.page,
            total: list.pageCount,
          }),
        }}
      />
    </div>
  );
}
