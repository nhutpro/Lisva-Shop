import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const tone: Record<OrderStatus, string> = {
  PENDING_CONTACT: "bg-gold/15 text-[#7a5a1f]",
  CONTACTED: "bg-blue-600/10 text-blue-800",
  CONFIRMED: "bg-green-600/10 text-green-800",
  SHIPPING: "bg-primary/10 text-primary",
  COMPLETED: "bg-green-700/15 text-green-900",
  CANCELLED: "bg-destructive/10 text-destructive",
};

/** The status of an order as a small coloured label. The text always says what it is (colour is only a hint). */
export function StatusBadge({ status, label, className }: { status: OrderStatus; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", tone[status], className)}>{label}</span>
  );
}
