import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { allowedTransitions } from "../orders/manage-order";

export const ADMIN_ORDERS_PER_PAGE = 20;
export const LOW_STOCK_LIMIT = 5;

export type AdminOrderFilters = {
  status?: OrderStatus;
  /** Only orders the owner has not opened yet. */
  onlyNew?: boolean;
  /** Matches the order code, the customer's name, or digits of the phone number. */
  q?: string;
  page?: number;
};

export type AdminOrderRow = {
  id: string;
  code: string;
  createdAt: string;
  customerName: string;
  phone: string;
  preferredContact: "PHONE" | "ZALO";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  isNew: boolean;
};

export type AdminOrderList = {
  items: AdminOrderRow[];
  total: number;
  page: number;
  pageCount: number;
};

/** Digits only, with the country code turned into a leading zero: "+84 912 345 678" -> "0912345678". */
export function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("84") && digits.length > 9
    ? `0${digits.slice(2)}`
    : digits;
}

function buildWhere({
  status,
  onlyNew,
  q,
}: AdminOrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (status) and.push({ status });
  if (onlyNew) and.push({ adminSeenAt: null });

  const text = q?.trim();
  if (text) {
    const digits = phoneDigits(text);
    const or: Prisma.OrderWhereInput[] = [
      { code: { contains: text.toUpperCase() } },
      { customerName: { contains: text, mode: "insensitive" } },
    ];
    if (digits.length >= 3) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

export async function listAdminOrders(
  db: PrismaClient,
  filters: AdminOrderFilters = {},
): Promise<AdminOrderList> {
  const where = buildWhere(filters);
  const total = await db.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PER_PAGE));
  const page = Math.min(
    Math.max(1, Math.trunc(filters.page ?? 1) || 1),
    pageCount,
  );

  const rows = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_ORDERS_PER_PAGE,
    take: ADMIN_ORDERS_PER_PAGE,
    select: {
      id: true,
      code: true,
      createdAt: true,
      customerName: true,
      phone: true,
      preferredContact: true,
      status: true,
      paymentStatus: true,
      total: true,
      adminSeenAt: true,
      items: { select: { quantity: true } },
    },
  });

  return {
    items: rows.map((o) => ({
      id: o.id,
      code: o.code,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      phone: o.phone,
      preferredContact: o.preferredContact,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      isNew: o.adminSeenAt === null,
    })),
    total,
    page,
    pageCount,
  };
}

export type AdminOrderDetail = {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  /** The statuses this order may move to next. */
  nextStatuses: OrderStatus[];
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  paymentNote: string | null;
  stockDeducted: boolean;
  subtotal: number;
  shippingFee: number | null;
  total: number;
  customerName: string;
  phone: string;
  email: string | null;
  preferredContact: "PHONE" | "ZALO";
  province: string;
  district: string;
  ward: string;
  street: string;
  customerNote: string | null;
  isNew: boolean;
  account: { email: string; name: string | null } | null;
  items: {
    id: string;
    /** Null once the variant was deleted from the shop. */
    variantId: string | null;
    productName: string;
    colorName: string | null;
    sizeLabel: string | null;
    sku: string;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  history: {
    id: string;
    from: OrderStatus | null;
    to: OrderStatus;
    at: string;
    by: string | null;
  }[];
  notes: { id: string; body: string; at: string; by: string | null }[];
};

const person = (u: { name: string | null; email: string } | null) =>
  u ? (u.name ?? u.email) : null;

export async function getAdminOrder(
  db: PrismaClient,
  code: string,
): Promise<AdminOrderDetail | null> {
  const o = await db.order.findUnique({
    where: { code },
    include: {
      user: { select: { email: true, name: true } },
      items: { orderBy: { id: "asc" } },
      history: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { email: true, name: true } } },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { email: true, name: true } } },
      },
    },
  });
  if (!o) return null;

  return {
    id: o.id,
    code: o.code,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    nextStatuses: allowedTransitions[o.status],
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paidAt: o.paidAt?.toISOString() ?? null,
    paymentNote: o.paymentNote,
    stockDeducted: o.stockDeducted,
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    total: o.total,
    customerName: o.customerName,
    phone: o.phone,
    email: o.email,
    preferredContact: o.preferredContact,
    province: o.province,
    district: o.district,
    ward: o.ward,
    street: o.street,
    customerNote: o.customerNote,
    isNew: o.adminSeenAt === null,
    account: o.user,
    items: o.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productName: i.productName,
      colorName: i.colorName,
      sizeLabel: i.sizeLabel,
      sku: i.sku,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    history: o.history.map((h) => ({
      id: h.id,
      from: h.fromStatus,
      to: h.toStatus,
      at: h.createdAt.toISOString(),
      by: person(h.changedBy),
    })),
    notes: o.notes.map((n) => ({
      id: n.id,
      body: n.body,
      at: n.createdAt.toISOString(),
      by: person(n.author),
    })),
  };
}

export type AdminOverview = {
  newOrders: number;
  pendingContact: number;
  toShip: number;
  lowStockVariants: number;
  latest: AdminOrderRow[];
};

export async function getAdminOverview(
  db: PrismaClient,
): Promise<AdminOverview> {
  const [newOrders, pendingContact, toShip, lowStockVariants, latest] =
    await Promise.all([
      db.order.count({ where: { adminSeenAt: null } }),
      db.order.count({ where: { status: "PENDING_CONTACT" } }),
      db.order.count({ where: { status: "CONFIRMED" } }),
      db.productVariant.count({
        where: {
          isActive: true,
          stock: { lte: LOW_STOCK_LIMIT },
          product: { status: "ACTIVE" },
        },
      }),
      listAdminOrders(db, { page: 1 }),
    ]);
  return {
    newOrders,
    pendingContact,
    toShip,
    lowStockVariants,
    latest: latest.items.slice(0, 5),
  };
}

export type LowStockRow = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  label: string;
  stock: number;
};

/** Active variants of active products that are running out, fewest first. */
export async function getLowStock(
  db: PrismaClient,
  limit = 10,
): Promise<LowStockRow[]> {
  const rows = await db.productVariant.findMany({
    where: {
      isActive: true,
      stock: { lte: LOW_STOCK_LIMIT },
      product: { status: "ACTIVE" },
    },
    orderBy: [{ stock: "asc" }, { sku: "asc" }],
    take: limit,
    include: {
      product: { select: { id: true, nameVi: true } },
      color: { select: { nameVi: true } },
      size: { select: { label: true } },
    },
  });
  return rows.map((v) => ({
    variantId: v.id,
    productId: v.product.id,
    productName: v.product.nameVi,
    sku: v.sku,
    label: [v.color?.nameVi, v.size?.label].filter(Boolean).join(" · "),
    stock: v.stock,
  }));
}
