"use client";

import { useSyncExternalStore } from "react";
import { useCartStore } from "./store";

const subscribe = (onChange: () => void) => useCartStore.persist.onFinishHydration(onChange);

/**
 * True once the saved cart has been loaded from the browser. Until then the cart looks empty,
 * so pages should show a loading state instead of "your cart is empty".
 * (The server render and the first client render both report false, so they match.)
 */
export function useCartReady(): boolean {
  return useSyncExternalStore(subscribe, () => useCartStore.persist.hasHydrated(), () => false);
}
