// @vitest-environment node
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { basics, buildShop, resetDb, testDb, validCustomer } from "../../test/db";
import { createRateLimiter } from "../rate-limit";
import type { OrderAlertInput } from "../telegram";
import { submitOrder, type SubmitDeps } from "./submit-order";

let shop: Awaited<ReturnType<typeof buildShop>>;
let notify: ReturnType<typeof vi.fn<(order: OrderAlertInput) => void>>;
let log: ReturnType<typeof vi.fn<(message: string) => void>>;

const deps = (overrides: Partial<SubmitDeps> = {}): SubmitDeps => ({
  db: testDb,
  limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
  notify,
  log,
  ...overrides,
});

const raw = (extra: Record<string, unknown> = {}) => ({
  ...validCustomer,
  items: [{ variantId: shop.digi.id, quantity: 2 }],
  ...extra,
});
const send = (extra: Record<string, unknown> = {}, d: SubmitDeps = deps(), more: Partial<Parameters<typeof submitOrder>[1]> = {}) =>
  submitOrder(d, { raw: raw(extra), clientKey: "1.2.3.4", ...more });

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
  notify = vi.fn();
  log = vi.fn();
});

describe("a valid request", () => {
  it("saves the order and returns its code", async () => {
    const result = await send();
    expect(result).toMatchObject({ ok: true, code: expect.stringMatching(/^LV-\d{4}-[2-9A-HJ-NP-Z]{4}$/) });

    const order = await testDb.order.findFirstOrThrow({ include: { items: true } });
    expect(order).toMatchObject({ phone: "0912345678", status: "PENDING_CONTACT", subtotal: 1_180_000 });
    expect(result.ok && result.code).toBe(order.code);
  });

  it("alerts the owner exactly once, with the saved order's details", async () => {
    await send({ customerNote: "Gọi trước khi giao" });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      customerName: "Nguyễn An",
      phone: "0912345678",
      preferredContact: "ZALO",
      customerNote: "Gọi trước khi giao",
      subtotal: 1_180_000,
      items: [expect.objectContaining({ sku: "TIDE-DIGI", quantity: 2, lineTotal: 1_180_000 })],
    });
  });

  it("a repeated submit with the same key returns the same code and does not alert again", async () => {
    const first = await send({ idempotencyKey: "checkout-key-0001" });
    const second = await send({ idempotencyKey: "checkout-key-0001" });

    expect(first).toEqual(second);
    expect(await testDb.order.count()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when scheduling the alert fails", async () => {
    notify.mockImplementation(() => {
      throw new Error("could not schedule");
    });
    const result = await send();
    expect(result.ok).toBe(true);
    expect(await testDb.order.count()).toBe(1);
    expect(log).toHaveBeenCalledWith("could not schedule the owner alert");
  });
});

describe("protection against abuse", () => {
  it("pretends to succeed for a bot that filled the hidden field, and creates nothing", async () => {
    const result = await send({}, deps(), { honeypot: "http://spam.example" });
    expect(result.ok).toBe(true);
    expect(await testDb.order.count()).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("treats a blank hidden field as a real shopper", async () => {
    expect((await send({}, deps(), { honeypot: "   " })).ok).toBe(true);
    expect(await testDb.order.count()).toBe(1);
  });

  it("stops a client that sends too many requests, and says when to retry", async () => {
    const d = deps({ limiter: createRateLimiter({ limit: 2, windowMs: 600_000 }) });
    expect((await send({}, d)).ok).toBe(true);
    expect((await send({}, d)).ok).toBe(true);

    const blocked = await send({}, d);
    expect(blocked).toEqual({ ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: expect.any(Number) } });
    expect(blocked.ok === false && blocked.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(await testDb.order.count()).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("does not count requests that fail validation, so fixing typos never locks a shopper out", async () => {
    const d = deps({ limiter: createRateLimiter({ limit: 1, windowMs: 600_000 }) });
    for (let i = 0; i < 5; i++) {
      const bad = await send({ phone: "12345" }, d);
      expect(bad.ok === false && bad.error.code).toBe("INVALID_INPUT"); // validation errors, never RATE_LIMITED
    }
    expect((await send({}, d)).ok).toBe(true); // the first well-formed request still gets through
    const blocked = await send({}, d);
    expect(blocked.ok === false && blocked.error.code).toBe("RATE_LIMITED");
  });

  it("limits each client separately", async () => {
    const d = deps({ limiter: createRateLimiter({ limit: 1, windowMs: 600_000 }) });
    expect((await submitOrder(d, { raw: raw(), clientKey: "a" })).ok).toBe(true);
    expect((await submitOrder(d, { raw: raw(), clientKey: "b" })).ok).toBe(true);
    expect((await submitOrder(d, { raw: raw(), clientKey: "a" })).ok).toBe(false);
  });
});

describe("validation", () => {
  it("reports each problem on its own field and creates nothing", async () => {
    const result = await send({ customerName: "", phone: "12345", email: "not-an-email", street: "", customerNote: "x".repeat(501) });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: {
          customerName: "required",
          phone: "invalid_phone",
          email: "invalid_email",
          street: "required",
          customerNote: "too_long",
        },
      },
    });
    expect(await testDb.order.count()).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("asks for a phone number when it is empty, and for a valid one when it is malformed", async () => {
    const empty = await send({ phone: "" });
    expect(empty.ok === false && empty.error.fieldErrors).toEqual({ phone: "required" });
    const bad = await send({ phone: "0112345678" });
    expect(bad.ok === false && bad.error.fieldErrors).toEqual({ phone: "invalid_phone" });
  });

  it("accepts an empty email and an empty note", async () => {
    expect((await send({ email: "", customerNote: "" })).ok).toBe(true);
  });

  it("reports an empty cart on its own", async () => {
    expect(await send({ items: [] })).toEqual({ ok: false, error: { code: "EMPTY_CART" } });
  });

  it("rejects a quantity outside 1-20 and unknown contact methods", async () => {
    const qty = await send({ items: [{ variantId: shop.digi.id, quantity: 21 }] });
    expect(qty.ok).toBe(false);
    const contact = await send({ preferredContact: "FAX" });
    expect(contact.ok === false && contact.error.fieldErrors).toEqual({ preferredContact: "invalid" });
  });
});

describe("stock and availability", () => {
  it("names the cart line that is short on stock, and creates nothing", async () => {
    const result = await send({ items: [{ variantId: shop.wht42.id, quantity: 1 }] });
    expect(result).toEqual({ ok: false, error: { code: "OUT_OF_STOCK", variantId: shop.wht42.id } });
    expect(await testDb.order.count()).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("reports unavailable and unknown items", async () => {
    await testDb.productVariant.update({ where: { id: shop.blk41.id }, data: { isActive: false } });
    expect(await send({ items: [{ variantId: shop.blk41.id, quantity: 1 }] })).toEqual({
      ok: false,
      error: { code: "VARIANT_UNAVAILABLE", variantId: shop.blk41.id },
    });
    expect(await send({ items: [{ variantId: "gone", quantity: 1 }] })).toEqual({
      ok: false,
      error: { code: "VARIANT_NOT_FOUND", variantId: "gone" },
    });
  });

  it("does not trust prices sent by the browser", async () => {
    await send({ items: [{ variantId: shop.digi.id, quantity: 1, unitPrice: 1, price: 1 }], total: 1, subtotal: 1 });
    expect((await testDb.order.findFirstOrThrow()).subtotal).toBe(590_000);
  });
});

describe("unexpected failures", () => {
  it("returns UNKNOWN and logs without any personal data", async () => {
    const brokenDb = {
      order: { findUnique: async () => null },
      $transaction: async () => {
        throw new Error("connection lost while inserting 0912345678 Nguyễn An 12 Lê Lợi");
      },
    } as unknown as PrismaClient;

    const result = await send({ idempotencyKey: "checkout-key-0009" }, deps({ db: brokenDb }));
    expect(result).toEqual({ ok: false, error: { code: "UNKNOWN" } });

    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("could not create an order");
    expect(logged).not.toMatch(/0912345678|Nguyễn|Lê Lợi|connection lost/);
    expect(notify).not.toHaveBeenCalled();
  });
});
