"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

// The cart lives in the browser and stores only which variant and how many.
// Prices and names are looked up from the server, never trusted from here.

export const MAX_QUANTITY = 20; // matches the order input schema
export const MAX_LINES = 30;

export type CartItem = { variantId: string; quantity: number };

const itemsSchema = z.array(
  z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(MAX_QUANTITY) }),
);

/** Reads whatever was persisted; corrupted or tampered data becomes an empty cart. */
export function parseItems(value: unknown): CartItem[] {
  const parsed = itemsSchema.safeParse(value);
  return parsed.success ? parsed.data.slice(0, MAX_LINES) : [];
}

export function addToItems(items: CartItem[], variantId: string, quantity = 1): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 1) return items;
  const existing = items.find((i) => i.variantId === variantId);
  if (existing) {
    return items.map((i) =>
      i.variantId === variantId ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_QUANTITY) } : i,
    );
  }
  if (items.length >= MAX_LINES) return items;
  return [...items, { variantId, quantity: Math.min(quantity, MAX_QUANTITY) }];
}

export function setItemQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 1) return items.filter((i) => i.variantId !== variantId);
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(quantity, MAX_QUANTITY) } : i));
}

export const cartCount = (items: CartItem[]) => items.reduce((sum, i) => sum + i.quantity, 0);

type CartState = {
  items: CartItem[];
  add: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (variantId, quantity = 1) => set((s) => ({ items: addToItems(s.items, variantId, quantity) })),
      setQuantity: (variantId, quantity) => set((s) => ({ items: setItemQuantity(s.items, variantId, quantity) })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "lisva-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      // Rehydrated in an effect (see CartHydrator) so server and first client render match.
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        items: parseItems((persisted as { items?: unknown } | undefined)?.items),
      }),
    },
  ),
);

/** Total number of pieces, for the header badge. */
export const useCartCount = () => useCartStore((s) => cartCount(s.items));
