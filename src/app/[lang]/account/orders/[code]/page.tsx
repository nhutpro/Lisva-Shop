import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { StatusBadge } from "@/components/account/status-badge";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/current-user";
import { getUserOrder } from "@/lib/auth/user-orders";
import { db } from "@/lib/db";
import { formatDate, formatVnd } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";

export default async function OrderDetailPage({ params }: PageProps<"/[lang]/account/orders/[code]">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OrderDetailContent params={params} locale={locale} dict={dict} />
    </Suspense>
  );
}

async function OrderDetailContent({ params, locale, dict }: { params: Promise<{ code: string }>; locale: Locale; dict: Dictionary }) {
  const { code } = await params;
  const user = await requireUser(locale, localePath(locale, `/account/orders/${code}`));
  const order = await getUserOrder(db, user.id, code);
  // Someone else's order and an unknown code look the same.
  if (!order) notFound();
  const t = dict.auth.orders;

  return (
    <div>
      <Link href={localePath(locale, "/account/orders")} className="text-sm underline underline-offset-4">
        ← {t.back}
      </Link>
      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-medium">{format(t.detailTitle, { code: order.code })}</h2>
        <StatusBadge status={order.status} label={dict.orderStatus[order.status]} />
      </div>
      <p className="mb-6 text-muted-foreground">{format(t.placedOn, { date: formatDate(order.createdAt) })}</p>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="order-items" className="rounded-lg bg-surface p-6 shadow-soft">
          <h3 id="order-items" className="mb-4 text-xl font-medium">
            {t.itemsTitle}
          </h3>
          <ul role="list" className="divide-y divide-border">
            {order.items.map((i) => (
              <li key={`${i.sku}`} className="flex gap-4 py-4">
                <span className="relative block size-20 shrink-0 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)]">
                  {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="80px" className="object-contain p-1.5" />}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{i.productName}</p>
                  {(i.colorName || i.sizeLabel) && <p className="text-muted-foreground">{[i.colorName, i.sizeLabel].filter(Boolean).join(" · ")}</p>}
                  <p className="text-muted-foreground tabular-nums">
                    {i.quantity} × {formatVnd(i.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">{formatVnd(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t.subtotal}</dt>
              <dd className="tabular-nums">{formatVnd(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t.shipping}</dt>
              <dd className="text-right tabular-nums">{order.shippingFee === null ? t.shippingPending : formatVnd(order.shippingFee)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt className="font-medium">{t.totalLabel}</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatVnd(order.total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t.payment}</dt>
              <dd>{dict.paymentStatus[order.paymentStatus]}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="order-address" className="rounded-lg bg-surface p-6 shadow-soft text-sm">
            <h3 id="order-address" className="mb-3 text-xl font-medium">
              {t.address}
            </h3>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-muted-foreground tabular-nums">{order.phone}</p>
            <p className="mt-1">{[order.street, order.ward, order.district, order.province].join(", ")}</p>
            <p className="mt-3 text-muted-foreground">
              {t.contact}: {dict.contactMethod[order.preferredContact]}
            </p>
            {order.customerNote && (
              <p className="mt-3">
                <span className="text-muted-foreground">{t.note}: </span>
                {order.customerNote}
              </p>
            )}
          </section>

          <section aria-labelledby="order-timeline" className="rounded-lg bg-surface p-6 shadow-soft">
            <h3 id="order-timeline" className="mb-4 text-xl font-medium">
              {t.timeline}
            </h3>
            <ol className="space-y-4 border-l border-border pl-5">
              {order.history.map((h, i) => (
                <li key={`${h.status}-${h.at}`} className="relative text-sm">
                  <span aria-hidden className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ${i === order.history.length - 1 ? "bg-gold" : "bg-border"}`} />
                  <p className="font-medium">{dict.orderStatus[h.status]}</p>
                  <p className="text-muted-foreground tabular-nums">{formatDate(h.at)}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-muted-foreground">
              {t.needHelp} <a href={`tel:${siteConfig.hotline.replace(/\s/g, "")}`} className="font-medium text-foreground underline underline-offset-4">{siteConfig.hotline}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
