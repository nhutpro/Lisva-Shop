import { Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/account/account-skeleton";
import { StatusBadge } from "@/components/account/status-badge";
import { Card, ghostButton } from "@/components/admin/admin-ui";
import { OrderActions } from "@/components/admin/order-actions";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getAdminOrder } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { formatDate, formatVnd } from "@/lib/format";
import { markOrderSeen } from "@/lib/orders/manage-order";

export default async function AdminOrderPage({ params }: PageProps<"/[lang]/admin/orders/[code]">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OrderContent params={params} locale={locale} dict={dict} />
    </Suspense>
  );
}

async function OrderContent({ params, locale, dict }: { params: Promise<{ code: string }>; locale: Locale; dict: Dictionary }) {
  await requireAdmin();
  const { code } = await params;
  const order = await getAdminOrder(db, code);
  if (!order) notFound();
  // Opening an order clears its "new" badge (we still show that it was new when opened).
  if (order.isNew) await markOrderSeen(db, order.id);

  const t = dict.admin.order;
  const telHref = `tel:${order.phone}`;
  const zaloHref = `https://zalo.me/${order.phone}`;

  return (
    <div>
      <Link href={localePath(locale, "/admin/orders")} className="text-sm underline underline-offset-4">
        ← {t.back}
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-medium">{format(t.title, { code: order.code })}</h2>
        <StatusBadge status={order.status} label={dict.orderStatus[order.status]} />
        {order.isNew && <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-accent-foreground">{t.newOrder}</span>}
        <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Card title={t.customer} id="customer">
            <p className="text-lg font-medium">{order.customerName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={telHref} className={ghostButton}>
                <Phone className="size-4" aria-hidden />
                {format(t.call, { phone: order.phone })}
              </a>
              <a href={zaloHref} target="_blank" rel="noopener noreferrer" className={ghostButton}>
                {t.zalo}
              </a>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t.prefers}</dt>
                <dd className="font-medium">{dict.contactMethod[order.preferredContact]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.address}</dt>
                <dd>{[order.street, order.ward, order.district, order.province].join(", ")}</dd>
              </div>
              {order.email && (
                <div>
                  <dt className="text-muted-foreground">{t.email}</dt>
                  <dd>{order.email}</dd>
                </div>
              )}
              {order.customerNote && (
                <div>
                  <dt className="text-muted-foreground">{t.note}</dt>
                  <dd className="whitespace-pre-line">{order.customerNote}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">{t.account}</dt>
                <dd>{order.account ? `${order.account.name ?? ""} ${order.account.email}`.trim() : t.guest}</dd>
              </div>
            </dl>
          </Card>

          <Card title={t.items} id="items">
            <ul role="list" className="divide-y divide-border">
              {order.items.map((i) => (
                <li key={i.id} className="flex gap-4 py-3">
                  <span className="relative block size-16 shrink-0 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_55%,#fff,#efebe2)]">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-contain p-1" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{i.productName}</p>
                    <p className="text-muted-foreground">{[i.colorName, i.sizeLabel].filter(Boolean).join(" · ")}</p>
                    <p className="text-muted-foreground tabular-nums">
                      {i.sku} · {i.quantity} × {formatVnd(i.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatVnd(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t.subtotal}</dt>
                <dd className="tabular-nums">{formatVnd(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t.shipping}</dt>
                <dd className="tabular-nums">{order.shippingFee === null ? t.shippingNotSet : formatVnd(order.shippingFee)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                <dt className="font-medium">{t.total}</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatVnd(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{order.stockDeducted ? t.stockDone : t.stockNotYet}</p>
          </Card>

          <Card title={t.historyTitle} id="history">
            <ol className="space-y-3 border-l border-border pl-5">
              {order.history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-gold" />
                  <p className="font-medium">
                    {h.from ? format(t.fromTo, { from: dict.orderStatus[h.from], to: dict.orderStatus[h.to] }) : `${t.created}: ${dict.orderStatus[h.to]}`}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    {formatDate(h.at)}
                    {h.by ? ` · ${format(t.by, { name: h.by })}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <OrderActions
            dict={dict}
            order={{
              id: order.id,
              status: order.status,
              nextStatuses: order.nextStatuses,
              shippingFee: order.shippingFee,
              paymentStatus: order.paymentStatus,
              paymentMethod: order.paymentMethod,
              paidAt: order.paidAt,
              paymentNote: order.paymentNote,
              items: order.items.map((i) => ({ variantId: i.variantId, productName: i.productName })),
            }}
          />
          <Card title={t.notesTitle} id="notes">
            {order.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noNotes}</p>
            ) : (
              <ul role="list" className="space-y-3">
                {order.notes.map((n) => (
                  <li key={n.id} className="rounded-sm bg-background p-3 text-sm">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {formatDate(n.at)}
                      {n.by ? ` · ${n.by}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
