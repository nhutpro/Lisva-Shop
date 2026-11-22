"use client";

import { User } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** A dropdown for the signed-in user. Closes on Escape, on a click outside, and after choosing an item. */
export function UserMenu({ label, initial, children }: { label: string; initial: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => ref.current?.removeAttribute("open");
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative hidden sm:block">
      <summary
        aria-label={label}
        className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-background text-sm font-semibold transition-colors duration-300 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        {initial ? <span aria-hidden>{initial}</span> : <User className="size-5" aria-hidden />}
      </summary>
      <div
        onClick={(e) => (e.target as HTMLElement).closest("a, button") && ref.current?.removeAttribute("open")}
        className="absolute right-0 z-50 mt-3 w-60 rounded-md border border-border bg-surface p-2 shadow-lift"
      >
        {children}
      </div>
    </details>
  );
}
