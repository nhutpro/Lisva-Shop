// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  basics,
  buildShop,
  resetDb,
  testDb,
  validCustomer,
} from "../../test/db";
import { createOrder } from "../orders/create-order";
import {
  addOrderNote,
  changeOrderStatus,
  markOrderSeen,
  recordPayment,
  setShippingFee,
} from "../orders/manage-order";
import {
  ADMIN_ORDERS_PER_PAGE,
  getAdminOrder,
  getAdminOverview,
  getLowStock,
  listAdminOrders,
  phoneDigits,
} from "./orders";

let shop: Awaited<ReturnType<typeof buildShop>>;
let admin: string;

const order = (extra: Record<string, unknown> = {}, quantity = 1) =>
  createOrder(testDb, {
    ...validCustomer,
    items: [{ variantId: shop.digi.id, quantity }],
    ...extra,
  });

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
  admin = (
    await testDb.user.create({
      data: { email: "owner@example.com", name: "Chủ shop", role: "ADMIN" },
    })
  ).id;
});

describe("phoneDigits", () => {
  it.each([
    ["0912 345 678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["091.234", "091234"],
    ["abc", ""],
  ])("%s -> %s", (input, expected) =>
    expect(phoneDigits(input)).toBe(expected),
  );
});

describe("listAdminOrders", () => {
  it("lists newest first with totals, item counts, and the 'new' mark until the order is opened", async () => {
    const first = await order({ customerName: "An" }, 2);
    const second = await order({ customerName: "Bình" });
    await markOrderSeen(testDb, first.id);

    const list = await listAdminOrders(testDb);
    expect(
      list.items.map((o) => [o.customerName, o.isNew, o.itemCount]),
    ).toEqual([
      ["Bình", true, 1],
      ["An", false, 2],
    ]);
    expect(list.items[1]).toMatchObject({
      total: 1_180_000,
      status: "PENDING_CONTACT",
      paymentStatus: "UNPAID",
      phone: "0912345678",
      id: first.id,
    });
    expect(second.code).toBe(list.items[0].code);
  });

  it("filters by status and by 'only new'", async () => {
    const a = await order({ customerName: "An" });
    await order({ customerName: "Bình" });
    await changeOrderStatus(testDb, a.id, "CONTACTED", admin);
    await markOrderSeen(testDb, a.id);

    expect(
      (await listAdminOrders(testDb, { status: "CONTACTED" })).items.map(
        (o) => o.customerName,
      ),
    ).toEqual(["An"]);
    expect(
      (await listAdminOrders(testDb, { onlyNew: true })).items.map(
        (o) => o.customerName,
      ),
    ).toEqual(["Bình"]);
    expect(
      (await listAdminOrders(testDb, { status: "CONTACTED", onlyNew: true }))
        .total,
    ).toBe(0);
  });

  it("searches by code, by name (any letter case), and by phone with any spacing", async () => {
    const a = await order({ customerName: "Nguyễn An", phone: "0912 345 678" });
    await order({ customerName: "Trần Bình", phone: "0987 654 321" });

    const names = async (q: string) =>
      (await listAdminOrders(testDb, { q })).items.map((o) => o.customerName);
    expect(await names(a.code)).toEqual(["Nguyễn An"]);
    expect(await names(a.code.toLowerCase())).toEqual(["Nguyễn An"]);
    expect(await names("nguyễn")).toEqual(["Nguyễn An"]);
    expect(await names("0912345678")).toEqual(["Nguyễn An"]);
    expect(await names("+84 987 654 321")).toEqual(["Trần Bình"]);
    expect(await names("345")).toEqual(["Nguyễn An"]); // part of a phone number
    expect(await names("khongco")).toEqual([]);
    expect((await names("  ")).length).toBe(2);
  });

  it("paginates by 20 and clamps the page", async () => {
    for (let i = 0; i < 22; i++) await order({ customerName: `Khách ${i}` });
    const p1 = await listAdminOrders(testDb, { page: 1 });
    expect(p1).toMatchObject({ total: 22, pageCount: 2 });
    expect(p1.items).toHaveLength(ADMIN_ORDERS_PER_PAGE);
    expect((await listAdminOrders(testDb, { page: 2 })).items).toHaveLength(2);
    expect((await listAdminOrders(testDb, { page: 99 })).page).toBe(2);
    expect((await listAdminOrders(testDb, { page: -1 })).page).toBe(1);
  });
});

describe("getAdminOrder", () => {
  it("returns everything the owner needs, including who did what", async () => {
    const created = await order({
      customerNote: "Giao sau 5h",
      email: "an@example.com",
      preferredContact: "ZALO",
    });
    await changeOrderStatus(testDb, created.id, "CONTACTED", admin);
    await setShippingFee(testDb, created.id, 30_000);
    await recordPayment(testDb, created.id, {
      method: "BANK_TRANSFER",
      note: "CK 14/11",
    });
    await addOrderNote(testDb, created.id, "Khách đã xác nhận qua Zalo", admin);

    const detail = await getAdminOrder(testDb, created.code);
    expect(detail).toMatchObject({
      code: created.code,
      status: "CONTACTED",
      nextStatuses: ["CONFIRMED", "CANCELLED"],
      customerName: "Nguyễn An",
      phone: "0912345678",
      email: "an@example.com",
      preferredContact: "ZALO",
      street: "12 Lê Lợi",
      customerNote: "Giao sau 5h",
      subtotal: 590_000,
      shippingFee: 30_000,
      total: 620_000,
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      paymentNote: "CK 14/11",
      stockDeducted: false,
      isNew: true,
      account: null,
      items: [
        {
          productName: "Tide Digital Pocket",
          sku: "TIDE-DIGI",
          quantity: 1,
          lineTotal: 590_000,
        },
      ],
    });
    expect(detail?.history.map((h) => [h.from, h.to, h.by])).toEqual([
      [null, "PENDING_CONTACT", null],
      ["PENDING_CONTACT", "CONTACTED", "Chủ shop"],
    ]);
    expect(detail?.notes).toEqual([
      expect.objectContaining({
        body: "Khách đã xác nhận qua Zalo",
        by: "Chủ shop",
      }),
    ]);
  });

  it("offers only the statuses the order may move to", async () => {
    const created = await order();
    const code = created.code;
    expect((await getAdminOrder(testDb, code))?.nextStatuses).toEqual([
      "CONTACTED",
      "CONFIRMED",
      "CANCELLED",
    ]);
    await changeOrderStatus(testDb, created.id, "CONFIRMED");
    expect((await getAdminOrder(testDb, code))?.nextStatuses).toEqual([
      "SHIPPING",
      "CANCELLED",
    ]);
    await changeOrderStatus(testDb, created.id, "CANCELLED");
    expect((await getAdminOrder(testDb, code))?.nextStatuses).toEqual([]);
  });

  it("shows the account of a signed-in customer, and returns null for an unknown code", async () => {
    const user = await testDb.user.create({
      data: { email: "an@example.com", name: "An" },
    });
    const created = await order({ userId: user.id });
    expect((await getAdminOrder(testDb, created.code))?.account).toEqual({
      email: "an@example.com",
      name: "An",
    });
    expect(await getAdminOrder(testDb, "LV-0000-NOPE")).toBeNull();
  });

  it("returns plain data that can be serialized", async () => {
    const created = await order();
    const detail = await getAdminOrder(testDb, created.code);
    expect(JSON.parse(JSON.stringify(detail))).toEqual(detail);
  });
});

describe("overview and low stock", () => {
  it("counts new orders, orders waiting for contact, confirmed orders to ship, and low-stock variants", async () => {
    const a = await order();
    const b = await order();
    const c = await order();
    await changeOrderStatus(testDb, b.id, "CONFIRMED");
    await markOrderSeen(testDb, a.id);
    await markOrderSeen(testDb, b.id);

    const overview = await getAdminOverview(testDb);
    expect(overview).toMatchObject({
      newOrders: 1,
      pendingContact: 2,
      toShip: 1,
    });
    expect(overview.latest.map((o) => o.code)).toEqual([
      c.code,
      b.code,
      a.code,
    ]);
    // Stock after confirming b: shoe variants 3, 5, 0 are <= 5 (BLK-41 has 5, BLK-42 has 3, WHT-42 has 0); the watch has 11.
    expect(overview.lowStockVariants).toBe(3);
  });

  it("lists low-stock variants fewest first and ignores switched-off ones and hidden products", async () => {
    await testDb.productVariant.update({
      where: { id: shop.blk41.id },
      data: { isActive: false },
    });
    const low = await getLowStock(testDb);
    expect(low.map((v) => [v.sku, v.stock])).toEqual([
      ["ZOOM-RUN-WHT-42", 0],
      ["ZOOM-RUN-BLK-42", 3],
    ]);
    expect(low[1]).toMatchObject({
      productName: "Zoomer Runner",
      label: "Đen · 42",
    });

    await testDb.product.update({
      where: { id: shop.shoe.id },
      data: { status: "DRAFT" },
    });
    expect(await getLowStock(testDb)).toEqual([]);
  });
});
