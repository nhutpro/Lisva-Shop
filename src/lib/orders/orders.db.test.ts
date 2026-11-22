// @vitest-environment node
import { ZodError } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import {
  basics,
  buildShop,
  resetDb,
  testDb,
  validCustomer,
} from "../../test/db";
import { createOrder } from "./create-order";
import {
  addOrderNote,
  changeOrderStatus,
  markOrderSeen,
  recordPayment,
  setShippingFee,
} from "./manage-order";

let shop: Awaited<ReturnType<typeof buildShop>>;

const stock = async (id: string) =>
  (await testDb.productVariant.findUniqueOrThrow({ where: { id } })).stock;
const order = (items: { variantId: string; quantity: number }[], extra = {}) =>
  createOrder(testDb, { ...validCustomer, items, ...extra });

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
});

describe("createOrder", () => {
  it("saves a new order request with a code, a snapshot of each item and a history row", async () => {
    const o = await order([
      { variantId: shop.blk42.id, quantity: 1 },
      { variantId: shop.digi.id, quantity: 2 },
    ]);

    expect(o.code).toMatch(/^LV-\d{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(o).toMatchObject({
      status: "PENDING_CONTACT",
      phone: "0912345678",
      preferredContact: "ZALO",
      paymentStatus: "UNPAID",
      shippingFee: null,
      adminSeenAt: null,
      stockDeducted: false,
      // variant price (2.490.000) + 2 x 590.000
      subtotal: 2_490_000 + 2 * 590_000,
      total: 2_490_000 + 2 * 590_000,
    });
    const shoeLine = o.items.find((i) => i.sku === "ZOOM-RUN-BLK-42");
    expect(shoeLine).toMatchObject({
      productName: "Zoomer Runner",
      colorName: "Đen",
      sizeLabel: "42",
      unitPrice: 2_490_000,
      lineTotal: 2_490_000,
      imageUrl: "/black-42.jpg", // the variant's own photo wins
    });
    const watchLine = o.items.find((i) => i.sku === "TIDE-DIGI");
    expect(watchLine).toMatchObject({
      colorName: null,
      sizeLabel: null,
      quantity: 2,
      lineTotal: 1_180_000,
    });

    const history = await testDb.orderStatusHistory.findMany({
      where: { orderId: o.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "PENDING_CONTACT",
    });
  });

  it("does not reduce stock when the order is submitted", async () => {
    await order([{ variantId: shop.blk42.id, quantity: 2 }]);
    expect(await stock(shop.blk42.id)).toBe(3);
  });

  it("uses the product price when the variant has none, and the color's photo before the general one", async () => {
    const o = await order([{ variantId: shop.blk41.id, quantity: 1 }]);
    expect(o.items[0]).toMatchObject({
      unitPrice: 2_390_000,
      imageUrl: "/black.jpg",
    });
  });

  it("merges the same variant given on several lines", async () => {
    const o = await order([
      { variantId: shop.blk41.id, quantity: 1 },
      { variantId: shop.blk41.id, quantity: 2 },
    ]);
    expect(o.items).toHaveLength(1);
    expect(o.items[0].quantity).toBe(3);
  });

  it("rejects quantities above the stock, and saves nothing", async () => {
    await expect(
      order([{ variantId: shop.blk42.id, quantity: 4 }]),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(
      order([{ variantId: shop.wht42.id, quantity: 1 }]),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await testDb.order.count()).toBe(0);
  });

  it("rejects unknown, inactive and draft items", async () => {
    await expect(
      order([{ variantId: "nope", quantity: 1 }]),
    ).rejects.toMatchObject({ code: "VARIANT_NOT_FOUND" });

    await testDb.productVariant.update({
      where: { id: shop.blk41.id },
      data: { isActive: false },
    });
    await expect(
      order([{ variantId: shop.blk41.id, quantity: 1 }]),
    ).rejects.toMatchObject({ code: "VARIANT_UNAVAILABLE" });

    await testDb.product.update({
      where: { id: shop.watch.id },
      data: { status: "DRAFT" },
    });
    await expect(
      order([{ variantId: shop.digi.id, quantity: 1 }]),
    ).rejects.toMatchObject({ code: "VARIANT_UNAVAILABLE" });
    expect(await testDb.order.count()).toBe(0);
  });

  it("rejects invalid input", async () => {
    await expect(order([], {})).rejects.toBeInstanceOf(ZodError);
    await expect(
      order([{ variantId: shop.digi.id, quantity: 1 }], { phone: "123" }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("keeps old orders unchanged when the catalog changes later", async () => {
    const o = await order([{ variantId: shop.blk42.id, quantity: 1 }]);

    await testDb.product.update({
      where: { id: shop.shoe.id },
      data: { nameVi: "Tên mới", price: 1 },
    });
    await testDb.productVariant.update({
      where: { id: shop.blk42.id },
      data: { price: 1, sku: "RENAMED" },
    });
    await testDb.size.update({
      where: {
        id: (
          await testDb.productVariant.findUniqueOrThrow({
            where: { id: shop.blk42.id },
          })
        ).sizeId!,
      },
      data: { label: "XX" },
    });

    const item = (
      await testDb.orderItem.findMany({ where: { orderId: o.id } })
    )[0];
    expect(item).toMatchObject({
      productName: "Zoomer Runner",
      unitPrice: 2_490_000,
      sku: "ZOOM-RUN-BLK-42",
      sizeLabel: "42",
    });
  });

  it("keeps the order readable after the product is deleted", async () => {
    const o = await order([{ variantId: shop.blk42.id, quantity: 1 }]);
    await testDb.product.delete({ where: { id: shop.shoe.id } });

    const item = (
      await testDb.orderItem.findMany({ where: { orderId: o.id } })
    )[0];
    expect(item).toMatchObject({
      variantId: null,
      productName: "Zoomer Runner",
      sizeLabel: "42",
      unitPrice: 2_490_000,
    });
  });
});

describe("changeOrderStatus", () => {
  it("deducts stock once when the owner confirms", async () => {
    const o = await order([
      { variantId: shop.blk42.id, quantity: 2 },
      { variantId: shop.digi.id, quantity: 3 },
    ]);

    const confirmed = await changeOrderStatus(testDb, o.id, "CONFIRMED");
    expect(confirmed).toMatchObject({
      status: "CONFIRMED",
      stockDeducted: true,
    });
    expect(await stock(shop.blk42.id)).toBe(1);
    expect(await stock(shop.digi.id)).toBe(9);

    await expect(
      changeOrderStatus(testDb, o.id, "CONFIRMED"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await stock(shop.blk42.id)).toBe(1);
  });

  it("restores stock once when a confirmed order is cancelled", async () => {
    const o = await order([{ variantId: shop.blk42.id, quantity: 2 }]);
    await changeOrderStatus(testDb, o.id, "CONFIRMED");
    await changeOrderStatus(testDb, o.id, "CANCELLED");

    expect(await stock(shop.blk42.id)).toBe(3);
    expect(
      (await testDb.order.findUniqueOrThrow({ where: { id: o.id } }))
        .stockDeducted,
    ).toBe(false);

    await expect(
      changeOrderStatus(testDb, o.id, "CANCELLED"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(await stock(shop.blk42.id)).toBe(3);
  });

  it("does not touch stock when an order is cancelled before it was confirmed", async () => {
    const o = await order([{ variantId: shop.blk42.id, quantity: 2 }]);
    await changeOrderStatus(testDb, o.id, "CONTACTED");
    await changeOrderStatus(testDb, o.id, "CANCELLED");
    expect(await stock(shop.blk42.id)).toBe(3);
  });

  it("restores stock when a shipping order is cancelled", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 4 }]);
    await changeOrderStatus(testDb, o.id, "CONFIRMED");
    await changeOrderStatus(testDb, o.id, "SHIPPING");
    expect(await stock(shop.digi.id)).toBe(8);
    await changeOrderStatus(testDb, o.id, "CANCELLED");
    expect(await stock(shop.digi.id)).toBe(12);
  });

  it("fails cleanly when stock ran out before confirming: status and other stock stay unchanged", async () => {
    const o = await order([
      { variantId: shop.digi.id, quantity: 2 },
      { variantId: shop.blk42.id, quantity: 3 },
    ]);
    // Someone else's order took the shoes in the meantime.
    await testDb.productVariant.update({
      where: { id: shop.blk42.id },
      data: { stock: 1 },
    });

    await expect(
      changeOrderStatus(testDb, o.id, "CONFIRMED"),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });

    expect(
      (await testDb.order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("PENDING_CONTACT");
    expect(await stock(shop.digi.id)).toBe(12); // rolled back, not half-deducted
    expect(await stock(shop.blk42.id)).toBe(1);
    expect(
      await testDb.orderStatusHistory.count({ where: { orderId: o.id } }),
    ).toBe(1);
  });

  it("records every change with who made it", async () => {
    const admin = await testDb.user.create({
      data: { email: "owner@example.com", role: "ADMIN" },
    });
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    await changeOrderStatus(testDb, o.id, "CONTACTED", admin.id);
    await changeOrderStatus(testDb, o.id, "CONFIRMED", admin.id);

    const history = await testDb.orderStatusHistory.findMany({
      where: { orderId: o.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, "PENDING_CONTACT"],
      ["PENDING_CONTACT", "CONTACTED"],
      ["CONTACTED", "CONFIRMED"],
    ]);
    expect(history[2].changedById).toBe(admin.id);
  });

  it("rejects impossible jumps and unknown orders", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    await expect(
      changeOrderStatus(testDb, o.id, "COMPLETED"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(
      changeOrderStatus(testDb, o.id, "SHIPPING"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(
      changeOrderStatus(testDb, "missing", "CONFIRMED"),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });
});

describe("owner tools", () => {
  it("marks an order as seen only the first time", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    await markOrderSeen(testDb, o.id);
    const first = (
      await testDb.order.findUniqueOrThrow({ where: { id: o.id } })
    ).adminSeenAt;
    expect(first).toBeInstanceOf(Date);

    await markOrderSeen(testDb, o.id);
    expect(
      (await testDb.order.findUniqueOrThrow({ where: { id: o.id } }))
        .adminSeenAt,
    ).toEqual(first);
  });

  it("sets the shipping fee and updates the total", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    const updated = await setShippingFee(testDb, o.id, 30_000);
    expect(updated).toMatchObject({
      shippingFee: 30_000,
      subtotal: 590_000,
      total: 620_000,
    });
    await expect(setShippingFee(testDb, o.id, -1)).rejects.toThrow(RangeError);
  });

  it("records a manual payment without changing the delivery status", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    const paid = await recordPayment(testDb, o.id, {
      method: "BANK_TRANSFER",
      note: "Chuyển khoản 14/11",
    });
    expect(paid).toMatchObject({
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      status: "PENDING_CONTACT",
    });
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  it("keeps the first payment record when payment is recorded again", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    const first = await recordPayment(testDb, o.id, {
      method: "BANK_TRANSFER",
      note: "lần 1",
    });
    const again = await recordPayment(testDb, o.id, {
      method: "COD",
      note: "lần 2",
    });
    expect(again).toMatchObject({
      paymentMethod: "BANK_TRANSFER",
      paymentNote: "lần 1",
    });
    expect(again.paidAt).toEqual(first.paidAt);
  });

  it("does not record payment or change the shipping fee on a closed order", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    await setShippingFee(testDb, o.id, 30_000);
    await changeOrderStatus(testDb, o.id, "CANCELLED");
    await expect(
      recordPayment(testDb, o.id, { method: "COD" }),
    ).rejects.toMatchObject({ code: "ORDER_CLOSED" });
    await expect(setShippingFee(testDb, o.id, 50_000)).rejects.toMatchObject({
      code: "ORDER_CLOSED",
    });
    expect(
      await testDb.order.findUniqueOrThrow({ where: { id: o.id } }),
    ).toMatchObject({
      paymentStatus: "UNPAID",
      shippingFee: 30_000,
      total: 620_000,
    });

    const done = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    for (const to of ["CONFIRMED", "SHIPPING", "COMPLETED"] as const)
      await changeOrderStatus(testDb, done.id, to);
    await expect(setShippingFee(testDb, done.id, 1)).rejects.toMatchObject({
      code: "ORDER_CLOSED",
    });
    await expect(
      recordPayment(testDb, done.id, { method: "COD" }),
    ).resolves.toMatchObject({ paymentStatus: "PAID" });
  });

  it("reports an unknown order", async () => {
    await expect(
      recordPayment(testDb, "nope", { method: "COD" }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    await expect(setShippingFee(testDb, "nope", 1)).rejects.toMatchObject({
      code: "ORDER_NOT_FOUND",
    });
  });

  it("stores private notes", async () => {
    const o = await order([{ variantId: shop.digi.id, quantity: 1 }]);
    await addOrderNote(testDb, o.id, "  Khách hẹn giao sau 5h  ");
    const notes = await testDb.orderNote.findMany({ where: { orderId: o.id } });
    expect(notes.map((n) => n.body)).toEqual(["Khách hẹn giao sau 5h"]);
  });
});
