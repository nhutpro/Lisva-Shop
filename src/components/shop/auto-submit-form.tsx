"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"form">, "action" | "method" | "onChange" | "onSubmit"> & {
  /** Page the form filters, e.g. "/vi/products". Without JavaScript the form still submits to it as a plain GET. */
  action: string;
  /** Apply on every change (price fields wait until typing pauses). When false, only the button or Enter applies. */
  auto?: boolean;
};

const PRICE_DELAY_MS = 600;

/**
 * A GET filter form that updates the URL without a full page load or losing the scroll position.
 * Empty fields are left out of the URL. Works as a normal form when JavaScript is off.
 */
export function AutoSubmitForm({ action, auto = false, children, ...rest }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.append(key, value);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${action}?${query}` : action, { scroll: false }));
  };

  return (
    <form
      {...rest}
      action={action}
      method="get"
      aria-busy={pending}
      onChange={(event) => {
        if (!auto) return;
        const form = event.currentTarget; // read now: currentTarget is cleared after the handler returns
        const isPrice = event.target instanceof HTMLInputElement && event.target.type === "number";
        clearTimeout(timer.current);
        timer.current = setTimeout(() => apply(form), isPrice ? PRICE_DELAY_MS : 0);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        clearTimeout(timer.current);
        apply(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
