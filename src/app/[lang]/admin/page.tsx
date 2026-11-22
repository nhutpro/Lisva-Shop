import Link from "next/link";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { Card, StatCard, ghostButton } from "@/components/admin/admin-ui";
import { OrderRow } from "@/components/admin/order-row";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getAdminOverview, getLowStock } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export default async function AdminOverviewPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OverviewContent locale={locale} dict={dict} />
    </Suspense>
  );
}

async function OverviewContent({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  await requireAdmin();
  const [overview, lowStock] = await Promise.all([getAdminOverview(db), getLowStock(db)]);
  const t = dict.admin.overview;
  const orders = localePath(locale, "/admin/orders");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.newOrders} value={overview.newOrders} href={`${orders}?new=1`} tone="alert" />
        <StatCard label={t.pendingContact} value={overview.pendingContact} href={`${orders}?status=PENDING_CONTACT`} />
        <StatCard label={t.toShip} value={overview.toShip} href={`${orders}?status=CONFIRMED`} />
        <StatCard label={t.lowStock} value={overview.lowStockVariants} tone="alert" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title={t.latest} id="latest-orders" action={<Link href={orders} className={ghostButton}>{t.viewAll}</Link>}>
          {overview.latest.length === 0 ? (
            <p className="text-muted-foreground">{t.noOrders}</p>
          ) : (
            <ul role="list" className="space-y-3">
              {overview.latest.map((o) => (
                <OrderRow key={o.id} order={o} locale={locale} dict={dict} />
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.lowStockTitle} id="low-stock">
          {lowStock.length === 0 ? (
            <p className="text-muted-foreground">{t.nothingLow}</p>
          ) : (
            <ul role="list" className="divide-y divide-border">
              {lowStock.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <Link href={localePath(locale, `/admin/products/${v.productId}`)} className="min-w-0 hover:underline">
                    <span className="block truncate font-medium">{v.productName}</span>
                    <span className="block truncate text-muted-foreground">{[v.label, v.sku].filter(Boolean).join(" · ")}</span>
                  </Link>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${v.stock === 0 ? "bg-destructive/10 text-destructive" : "bg-gold/15 text-[#7a5a1f]"}`}>{v.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
