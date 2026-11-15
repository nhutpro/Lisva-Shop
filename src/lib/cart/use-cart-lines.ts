"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCartLines } from "@/app/[lang]/cart/actions";
import type { CartLineData } from "@/lib/catalog/cart-lines";
import { MAX_QUANTITY, useCartStore, type CartItem } from "./store";
import { useCartReady } from "./use-cart-ready";

export type CartRow =
  | { kind: "line"; item: CartItem; line: CartLineData; purchasable: boolean; adjustedTo: number | null }
  /** The variant no longer exists in the shop. */
  | { kind: "missing"; item: CartItem };

type Loaded = { key: string; lines: CartLineData[]; adjusted: Record<string, number> };

/** A line can be ordered when it is on sale and in stock. */
export const isPurchasable = (line: CartLineData) => line.available && line.stock > 0;

/** The most the shopper can add for a line. */
export const maxQuantityFor = (line: CartLineData) => Math.min(MAX_QUANTITY, line.stock);

/**
 * Joins the browser's cart (ids and quantities) with the shop's current data (names, prices, stock).
 * Quantities above the stock are lowered in the cart, and the shopper is told through `adjustedTo`.
 */
export function useCartLines() {
  const ready = useCartReady();
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const key = useMemo(() => items.map((i) => i.variantId).sort().join(","), [items]);

  useEffect(() => {
    if (!ready || key === "") return;
    let cancelled = false;
    loadCartLines(key.split(","))
      .then((lines) => {
        if (cancelled) return;
        // Lower quantities that exceed the current stock, remembering what changed.
        const adjusted: Record<string, number> = {};
        for (const { variantId, quantity } of useCartStore.getState().items) {
          const line = lines.find((l) => l.variantId === variantId);
          if (line && isPurchasable(line) && quantity > line.stock) {
            adjusted[variantId] = line.stock;
            setQuantity(variantId, line.stock);
          }
        }
        setFailedKey(null);
        setLoaded({ key, lines, adjusted });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, key, attempt, setQuantity]);

  const retry = useCallback(() => {
    setFailedKey(null);
    setAttempt((n) => n + 1);
  }, []);

  const empty = ready && items.length === 0;
  const error = ready && !empty && failedKey === key;
  // The first load has not finished (later changes keep showing the data we already have).
  const loading = !ready || (!empty && !error && loaded === null);

  const rows = useMemo<CartRow[]>(() => {
    if (loaded === null) return [];
    const byId = new Map(loaded.lines.map((l) => [l.variantId, l]));
    const settled = loaded.key === key; // false while a refresh for new ids is running
    return items.flatMap<CartRow>((item) => {
      const line = byId.get(item.variantId);
      if (line) {
        return [{ kind: "line", item, line, purchasable: isPurchasable(line), adjustedTo: loaded.adjusted[item.variantId] ?? null }];
      }
      return settled ? [{ kind: "missing", item }] : [];
    });
  }, [loaded, items, key]);

  const subtotal = rows.reduce(
    (sum, r) => (r.kind === "line" && r.purchasable ? sum + r.line.unitPrice * r.item.quantity : sum),
    0,
  );
  const blocked = rows.some((r) => r.kind === "missing" || !r.purchasable);

  return { ready, empty, loading, error, retry, rows, subtotal, blocked, items };
}
