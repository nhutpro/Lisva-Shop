"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

/** Loads the saved cart after the first render, so the server HTML and the first client render match. */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return null;
}
