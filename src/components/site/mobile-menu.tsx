"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

type Props = { label: string; closeLabel: string; children: ReactNode };

/** Disclosure menu for small screens. The links are server-rendered children. */
export function MobileMenu({ label, closeLabel, children }: Props) {
  const panelId = useId();
  const pathname = usePathname();
  // Open for one specific path: navigating to another page closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : label}
        onClick={() => setOpenFor(open ? null : pathname)}
        className="grid size-11 place-items-center rounded-full bg-background transition-colors duration-300 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpenFor(null);
        }}
        className="absolute inset-x-0 top-full mt-3 rounded-md border border-border bg-surface p-5 shadow-lift"
      >
        {children}
      </div>
    </div>
  );
}
