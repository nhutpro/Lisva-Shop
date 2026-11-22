// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { basics, buildShop, resetDb, testDb, validCustomer } from "../../test/db";
import { createOrder } from "../orders/create-order";
import { addOrderNote, changeOrderStatus, recordPayment, setShippingFee } from "../orders/manage-order";
import { ORDERS_PER_PAGE, getUserOrder, listUserOrders } from "./user-orders";

let shop: Awaited<ReturnType<typeof buildShop>>;
let an: string;
let binh: string;

const order = (userId: string | undefined, quantity = 1) =>
  createOrder(testDb, { ...validCustomer, userId, items: [{ variantId: shop.digi.id, quantity }] });

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
  an = (await testDb.user.create({ data: { email: "an@example.com" } })).id;
  binh = (await testDb.user.create({ data: { email: "binh@example.com" } })).id;
});

describe("listUserOrders", () => {
  it("lists only the user's own orders, newest first, with totals and item counts", async () => {
    const first = await order(an, 2);
    const second = await order(an, 1);
    await order(binh);
    await order(undefined); // a guest order belongs to nobody

    const list = await listUserOrders(testDb, an);
    expect(list.total).toBe(2);
    expect(list.items.map((o) => o.code)).toEqual([second.code, first.code]);
    expect(list.items[1]).toMatchObject({ itemCount: 2, total: 1_180_000, status: "PENDING_CONTACT" });
    expect(await listUserOrders(testDb, binh)).toMatchObject({ total: 1 });
  });

  it("splits into pages of 10 and clamps the page number", async () => {
    for (let i = 0; i < 12; i++) await order(an);
    const first = await listUserOrders(testDb, an, 1);
    expect(first).toMatchObject({ total: 12, page: 1, pageCount: 2 });
    expect(first.items).toHaveLength(ORDERS_PER_PAGE);
    expect((await listUserOrders(testDb, an, 2)).items).toHaveLength(2);
    expect(await listUserOrders(testDb, an, 99)).toMatchObject({ page: 2 });
    expect(await listUserOrders(testDb, an, -3)).toMatchObject({ page: 1 });
  });

  it("returns an empty first page for a user without orders", async () => {
    expect(await listUserOrders(testDb, an)).toEqual({ items: [], total: 0, page: 1, pageCount: 1 });
  });
});

describe("getUserOrder", () => {
  it("returns the order as it was placed, with its status history", async () => {
    const created = await order(an, 2);
    await changeOrderStatus(testDb, created.id, "CONTACTED");
    await changeOrderStatus(testDb, created.id, "CONFIRMED");

    const detail = await getUserOrder(testDb, an, created.code);
    expect(detail).toMatchObject({
      code: created.code,
      status: "CONFIRMED",
      customerName: "Nguyễn An",
      street: "12 Lê Lợi",
      subtotal: 1_180_000,
      shippingFee: null,
      items: [{ productName: "Tide Digital Pocket", sku: "TIDE-DIGI", quantity: 2, unitPrice: 590_000, lineTotal: 1_180_000 }],
    });
    expect(detail?.history.map((h) => h.status)).toEqual(["PENDING_CONTACT", "CONTACTED", "CONFIRMED"]);
  });

  it("shows another customer's order, a guest order and an unknown code exactly like a missing one", async () => {
    const mine = await order(an);
    const theirs = await order(binh);
    const guest = await order(undefined);

    expect(await getUserOrder(testDb, an, mine.code)).not.toBeNull();
    expect(await getUserOrder(testDb, an, theirs.code)).toBeNull();
    expect(await getUserOrder(testDb, an, guest.code)).toBeNull();
    expect(await getUserOrder(testDb, an, "LV-0000-NOPE")).toBeNull();
  });

  it("never exposes internal notes, the payment note, or who made a change", async () => {
    const created = await order(an);
    const admin = await testDb.user.create({ data: { email: "owner@example.com", role: "ADMIN" } });
    await addOrderNote(testDb, created.id, "Khách này hay đổi ý, cẩn thận", admin.id);
    await recordPayment(testDb, created.id, { method: "BANK_TRANSFER", note: "CK vietcombank 14/11" });
    await setShippingFee(testDb, created.id, 30_000);
    await changeOrderStatus(testDb, created.id, "CONTACTED", admin.id);

    const detail = await getUserOrder(testDb, an, created.code);
    expect(detail).toMatchObject({ paymentStatus: "PAID", shippingFee: 30_000, total: 620_000 });
    const text = JSON.stringify(detail);
    expect(text).not.toMatch(/đổi ý|vietcombank|changedBy|paymentNote|owner@example|stockDeducted|idempotency/);
  });

  it("returns plain data that can be serialized", async () => {
    const created = await order(an);
    const detail = await getUserOrder(testDb, an, created.code);
    expect(JSON.parse(JSON.stringify(detail))).toEqual(detail);
  });
});
