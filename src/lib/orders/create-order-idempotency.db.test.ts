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
import { createOrder, createOrderOnce } from "./create-order";

let shop: Awaited<ReturnType<typeof buildShop>>;

const submit = (idempotencyKey?: string, quantity = 1) =>
  createOrderOnce(testDb, {
    ...validCustomer,
    idempotencyKey,
    items: [{ variantId: shop.digi.id, quantity }],
  });

beforeEach(async () => {
  await resetDb();
  shop = await buildShop(await basics());
});

describe("createOrderOnce with an idempotency key", () => {
  it("returns the same order when the same key is submitted again", async () => {
    const first = await submit("checkout-key-0001");
    const second = await submit("checkout-key-0001");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.code).toBe(first.order.code);
    expect(await testDb.order.count()).toBe(1);
    expect(await testDb.orderItem.count()).toBe(1);
  });

  it("creates exactly one order when several requests with the same key arrive at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => submit("checkout-key-race")),
    );

    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.order.id)).size).toBe(1);
    expect(await testDb.order.count()).toBe(1);
  });

  it("treats different keys as different orders", async () => {
    const a = await submit("checkout-key-aaaa");
    const b = await submit("checkout-key-bbbb");
    expect(a.order.id).not.toBe(b.order.id);
    expect(await testDb.order.count()).toBe(2);
  });

  it("does not remember a failed attempt: the same key works once the problem is fixed", async () => {
    // 20 is the largest allowed quantity, and the watch only has 12 in stock.
    await expect(submit("checkout-key-retry", 20)).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
    expect(await testDb.order.count()).toBe(0);

    const retry = await submit("checkout-key-retry", 2);
    expect(retry.created).toBe(true);
    expect(retry.order.items[0].quantity).toBe(2);
  });

  it("rejects a malformed key", async () => {
    await expect(submit("short")).rejects.toBeInstanceOf(ZodError);
    await expect(submit("has spaces and symbols!")).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("without a key", () => {
  it("never merges submissions", async () => {
    await submit();
    await submit();
    expect(await testDb.order.count()).toBe(2);
  });

  it("createOrder still returns just the order", async () => {
    const order = await createOrder(testDb, {
      ...validCustomer,
      items: [{ variantId: shop.digi.id, quantity: 1 }],
    });
    expect(order.code).toMatch(/^LV-/);
  });
});
