import type { OrderStatus, PaymentStatus, PrismaClient } from "@prisma/client";

// What a customer may see of their own orders. Internal notes, the payment note and who changed
// a status are never included.

export const ORDERS_PER_PAGE = 10;

export type UserOrderSummary = {
  code: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
};

export type UserOrderList = { items: UserOrderSummary[]; total: number; page: number; pageCount: number };

export type UserOrderDetail = {
  code: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingFee: number | null;
  total: number;
  customerName: string;
  phone: string;
  preferredContact: "PHONE" | "ZALO";
  province: string;
  district: string;
  ward: string;
  street: string;
  customerNote: string | null;
  items: {
    productName: string;
    colorName: string | null;
    sizeLabel: string | null;
    sku: string;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  history: { status: OrderStatus; at: string }[];
};

export async function listUserOrders(db: PrismaClient, userId: string, page = 1): Promise<UserOrderList> {
  const where = { userId };
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (current - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
    select: { code: true, createdAt: true, status: true, total: true, items: { select: { quantity: true } } },
  });

  return {
    items: rows.map((o) => ({
      code: o.code,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      total: o.total,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    })),
    total,
    page: current,
    pageCount,
  };
}

/** One of the user's own orders by code, or null (also for someone else's order: the same answer). */
export async function getUserOrder(db: PrismaClient, userId: string, code: string): Promise<UserOrderDetail | null> {
  const o = await db.order.findFirst({
    where: { code, userId },
    select: {
      code: true, createdAt: true, status: true, paymentStatus: true, subtotal: true, shippingFee: true, total: true,
      customerName: true, phone: true, preferredContact: true, province: true, district: true, ward: true, street: true,
      customerNote: true,
      items: {
        select: { productName: true, colorName: true, sizeLabel: true, sku: true, imageUrl: true, unitPrice: true, quantity: true, lineTotal: true },
        orderBy: { id: "asc" },
      },
      history: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!o) return null;
  const { history, createdAt, ...rest } = o;
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    history: history.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString() })),
  };
}
