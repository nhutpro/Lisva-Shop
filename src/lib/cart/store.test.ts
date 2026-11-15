import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_LINES,
  MAX_QUANTITY,
  addToItems,
  cartCount,
  parseItems,
  setItemQuantity,
  useCartStore,
} from "./store";

describe("addToItems", () => {
  it("adds a new line and merges the same variant", () => {
    let items = addToItems([], "v1");
    items = addToItems(items, "v2", 2);
    items = addToItems(items, "v1", 3);
    expect(items).toEqual([{ variantId: "v1", quantity: 4 }, { variantId: "v2", quantity: 2 }]);
    expect(cartCount(items)).toBe(6);
  });

  it("caps a line at the maximum quantity", () => {
    expect(addToItems([{ variantId: "v1", quantity: 19 }], "v1", 5)).toEqual([{ variantId: "v1", quantity: MAX_QUANTITY }]);
    expect(addToItems([], "v1", 99)).toEqual([{ variantId: "v1", quantity: MAX_QUANTITY }]);
  });

  it("ignores bad quantities and a full cart", () => {
    expect(addToItems([], "v1", 0)).toEqual([]);
    expect(addToItems([], "v1", -2)).toEqual([]);
    expect(addToItems([], "v1", 1.5)).toEqual([]);
    const full = Array.from({ length: MAX_LINES }, (_, i) => ({ variantId: `v${i}`, quantity: 1 }));
    expect(addToItems(full, "new")).toBe(full);
  });
});

describe("setItemQuantity", () => {
  const items = [{ variantId: "v1", quantity: 2 }, { variantId: "v2", quantity: 1 }];
  it("updates, caps and removes", () => {
    expect(setItemQuantity(items, "v1", 5)[0].quantity).toBe(5);
    expect(setItemQuantity(items, "v1", 500)[0].quantity).toBe(MAX_QUANTITY);
    expect(setItemQuantity(items, "v1", 0)).toEqual([{ variantId: "v2", quantity: 1 }]);
  });
});

describe("parseItems", () => {
  it("accepts a valid cart", () => {
    expect(parseItems([{ variantId: "v1", quantity: 2 }])).toEqual([{ variantId: "v1", quantity: 2 }]);
  });
  it.each([null, undefined, "x", 5, {}, [{ variantId: "", quantity: 1 }], [{ variantId: "v", quantity: 0 }], [{ variantId: "v", quantity: 99 }], [{ quantity: 1 }]])(
    "turns %j into an empty cart",
    (bad) => {
      expect(parseItems(bad)).toEqual([]);
    },
  );
});

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [] });
  });

  it("adds, changes and removes items", () => {
    const { add, setQuantity, remove, clear } = useCartStore.getState();
    add("v1");
    add("v1");
    add("v2", 3);
    expect(cartCount(useCartStore.getState().items)).toBe(5);
    setQuantity("v2", 1);
    remove("v1");
    expect(useCartStore.getState().items).toEqual([{ variantId: "v2", quantity: 1 }]);
    clear();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("persists only the items and restores them on rehydrate", async () => {
    useCartStore.getState().add("v1", 2);
    const raw = localStorage.getItem("lisva-cart")!;
    expect(JSON.parse(raw).state).toEqual({ items: [{ variantId: "v1", quantity: 2 }] });

    // Simulate a fresh page load: empty in-memory state, saved cart still in localStorage.
    useCartStore.setState({ items: [] }); // (this also overwrites localStorage, so put it back)
    localStorage.setItem("lisva-cart", raw);
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().items).toEqual([{ variantId: "v1", quantity: 2 }]);
  });

  it("survives corrupted stored data", async () => {
    localStorage.setItem("lisva-cart", JSON.stringify({ state: { items: [{ variantId: "v1", quantity: "lots" }] }, version: 1 }));
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().items).toEqual([]);

    localStorage.setItem("lisva-cart", "not json at all");
    await expect(useCartStore.persist.rehydrate()).resolves.not.toThrow();
    expect(useCartStore.getState().items).toEqual([]);
  });
});
