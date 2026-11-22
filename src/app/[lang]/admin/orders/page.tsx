import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { Pager, TextField, SelectField, button, ghostButton } from "@/components/admin/admin-ui";
import { OrderRow } from "@/components/admin/order-row";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { listAdminOrders } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import Link from "next/link";

const STATUSES = ["PENDING_CONTACT", "CONTACTED", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"] as const;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/[lang]/admin/orders">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OrdersContent searchParams={searchParams} locale={locale} dict={dict} />
    </Suspense>
  );
}

async function OrdersContent({
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
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const status = STATUSES.find((s) => s === one(raw.status));
  const onlyNew = one(raw.new) === "1";
  const q = one(raw.q)?.trim().slice(0, 80) || undefined;
  const page = Number(one(raw.page)) || 1;
  const list = await listAdminOrders(db, { status, onlyNew, q, page });

  const t = dict.admin;
  const base = localePath(locale, "/admin/orders");
  const filters = { status, new: onlyNew ? "1" : undefined, q };

  return (
    <div>
      <h2 className="sr-only">{t.orders.title}</h2>
      <form action={base} method="get" role="search" className="mb-6 grid items-end gap-3 rounded-lg bg-surface p-4 shadow-soft sm:grid-cols-[1fr_220px_auto_auto] sm:p-5">
        <TextField id="orders-q" name="q" type="search" label={t.orders.searchLabel} placeholder={t.orders.searchPlaceholder} defaultValue={q} maxLength={80} />
        <SelectField id="orders-status" name="status" label={t.orders.status} defaultValue={status ?? ""}>
          <option value="">{t.common.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {dict.orderStatus[s]}
            </option>
          ))}
        </SelectField>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="new" value="1" defaultChecked={onlyNew} className="size-4 accent-gold" />
          {t.orders.onlyNew}
        </label>
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
        <p className="rounded-lg bg-surface p-8 text-muted-foreground shadow-soft">{t.orders.empty}</p>
      ) : (
        <ul role="list" className="space-y-3">
          {list.items.map((o) => (
            <OrderRow key={o.id} order={o} locale={locale} dict={dict} />
          ))}
        </ul>
      )}
      <Pager
        base={base}
        params={filters}
        page={list.page}
        pageCount={list.pageCount}
        labels={{ previous: t.common.previous, next: t.common.next, page: format(t.common.page, { page: list.page, total: list.pageCount }) }}
      />
    </div>
  );
}
