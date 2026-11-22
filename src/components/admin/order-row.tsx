import Link from "next/link";
import { StatusBadge } from "@/components/account/status-badge";
import { localePath, type Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { AdminOrderRow } from "@/lib/admin/orders";
import { formatDate, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One order in a list. New orders (not opened yet) are marked with a badge and a stronger border. */
export function OrderRow({ order, locale, dict }: { order: AdminOrderRow; locale: Locale; dict: Dictionary }) {
  const t = dict.admin.orders;
  return (
    <li className={cn("rounded-md bg-surface shadow-soft", order.isNew && "ring-2 ring-gold")}>
      <Link
        href={localePath(locale, `/admin/orders/${order.code}`)}
        aria-label={format(t.open, { code: order.code })}
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md p-4 transition-colors duration-300 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
      >
        <div className="min-w-40">
          <p className="flex items-center gap-2">
            <span className="font-heading text-lg font-semibold tracking-wide tabular-nums">{order.code}</span>
            {order.isNew && <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{t.newBadge}</span>}
          </p>
          <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <div className="min-w-44 flex-1">
          <p className="font-medium">{order.customerName}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {order.phone} · {dict.contactMethod[order.preferredContact]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} label={dict.orderStatus[order.status]} />
          {order.paymentStatus === "PAID" && <span className="rounded-full bg-green-600/10 px-2.5 py-1 text-xs font-semibold text-green-800">{t.paid}</span>}
        </div>
        <p className="ml-auto font-semibold tabular-nums">{formatVnd(order.total)}</p>
      </Link>
    </li>
  );
}
