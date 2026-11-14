import type { OrderStatus, PaymentMethod, PrismaClient } from "@prisma/client";
import { OrderError } from "./errors";

export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONTACT: ["CONTACTED", "CONFIRMED", "CANCELLED"],
  CONTACTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Moves an order to a new status and records the change.
 * Moving to CONFIRMED deducts stock (once); CANCELLED after that gives it back (once).
 * Everything runs in one transaction, so a failed stock deduction leaves the order untouched.
 */
export async function changeOrderStatus(
  db: PrismaClient,
  orderId: string,
  toStatus: OrderStatus,
  actorId: string | null = null,
) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", { orderId });
    if (!allowedTransitions[order.status].includes(toStatus)) {
      throw new OrderError("INVALID_TRANSITION", { from: order.status, to: toStatus });
    }

    const deduct = toStatus === "CONFIRMED" && !order.stockDeducted;
    const restore = toStatus === "CANCELLED" && order.stockDeducted;

    // Guarded by the current status so two admins clicking at once cannot both win.
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: toStatus,
        stockDeducted: deduct ? true : restore ? false : order.stockDeducted,
      },
    });
    if (updated.count === 0) throw new OrderError("CONFLICT", { orderId });

    for (const item of order.items) {
      if (!item.variantId) continue; // variant was deleted; nothing to adjust
      if (deduct) {
        const r = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (r.count === 0) throw new OrderError("OUT_OF_STOCK", { variantId: item.variantId });
      } else if (restore) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus, changedById: actorId },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });
}

/** Clears the "new" badge the first time the owner opens an order. */
export async function markOrderSeen(db: PrismaClient, orderId: string) {
  await db.order.updateMany({ where: { id: orderId, adminSeenAt: null }, data: { adminSeenAt: new Date() } });
}

/** The owner records that the customer paid (manual, release 1). */
export async function recordPayment(
  db: PrismaClient,
  orderId: string,
  payment: { method: PaymentMethod; note?: string },
) {
  return db.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: payment.method,
      paymentNote: payment.note,
      paidAt: new Date(),
    },
  });
}

/** Sets the shipping fee quoted to the customer and updates the total. */
export async function setShippingFee(db: PrismaClient, orderId: string, shippingFee: number) {
  if (!Number.isInteger(shippingFee) || shippingFee < 0) throw new RangeError("shippingFee must be a whole VND amount >= 0");
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", { orderId });
    return tx.order.update({
      where: { id: orderId },
      data: { shippingFee, total: order.subtotal + shippingFee },
    });
  });
}

export async function addOrderNote(db: PrismaClient, orderId: string, body: string, authorId: string | null = null) {
  return db.orderNote.create({ data: { orderId, body: body.trim(), authorId } });
}
