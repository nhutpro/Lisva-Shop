import Link from "next/link";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { StatusBadge } from "@/components/account/status-badge";
import { primaryButton } from "@/components/cart/cart-parts";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/current-user";
import { listUserOrders } from "@/lib/auth/user-orders";
import { db } from "@/lib/db";
import { formatDate, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function OrdersPage({ searchParams }: PageProps<"/[lang]/account/orders">) {
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
  const here = localePath(locale, "/account/orders");
  const user = await requireUser(locale, here);
  const raw = (await searchParams).page;
  const orders = await listUserOrders(db, user.id, typeof raw === "string" ? Number(raw) : 1);
  const t = dict.auth.orders;

  if (orders.total === 0) {
    return (
      <div className="rounded-lg bg-surface px-6 py-14 text-center shadow-soft">
        <h2 className="text-2xl font-medium">{t.empty}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t.guestNote}</p>
        <Link href={localePath(locale, "/products")} className={cn(primaryButton, "mt-6")}>
          {t.emptyCta}
        </Link>
      </div>
    );
  }

  const link = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm hover:border-primary";
  return (
    <section aria-labelledby="orders-title">
      <h2 id="orders-title" className="mb-4 text-2xl font-medium">
        {t.title}
      </h2>
      <ul role="list" className="space-y-3">
        {orders.items.map((o) => (
          <li key={o.code} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-md bg-surface p-5 shadow-soft">
            <div>
              <p className="font-heading text-xl font-semibold tracking-wide tabular-nums">{o.code}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(o.createdAt)} · {format(t.items, { count: o.itemCount })}
              </p>
            </div>
            <StatusBadge status={o.status} label={dict.orderStatus[o.status]} />
            <p className="font-semibold tabular-nums">{formatVnd(o.total)}</p>
            <Link href={`${here}/${o.code}`} aria-label={format(t.viewLabel, { code: o.code })} className={link}>
              {t.view}
            </Link>
          </li>
        ))}
      </ul>
      {orders.pageCount > 1 && (
        <nav aria-label={dict.products.pagination.label} className="mt-8 flex items-center justify-center gap-3">
          {orders.page > 1 && (
            <Link href={`${here}?page=${orders.page - 1}`} rel="prev" className={link}>
              {dict.products.pagination.previous}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{format(dict.products.pagination.current, { page: orders.page, total: orders.pageCount })}</span>
          {orders.page < orders.pageCount && (
            <Link href={`${here}?page=${orders.page + 1}`} rel="next" className={link}>
              {dict.products.pagination.next}
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
