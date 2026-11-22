"use client";

import { Check, Copy, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { cn } from "@/lib/utils";
import { primaryButton } from "./cart-parts";

type Props = {
  code: string;
  labels: Dictionary["orderSuccess"];
  hotline: string;
  zaloUrl: string;
  productsHref: string;
  /** For a signed-in shopper: where to see this order. */
  orderHref?: string;
};

/**
 * Confirmation pop-up shown after an order request is sent. It is a native modal <dialog>:
 * the browser traps keyboard focus inside, closes it on Escape and dims the page behind it.
 */
export function OrderSuccessDialog({ code, labels, hotline, zaloUrl, productsHref, orderHref }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available: the code is still shown on screen to copy by hand.
    }
  };

  const link =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={textId}
      className="m-auto w-[min(520px,92vw)] rounded-lg bg-surface p-7 text-foreground shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:p-9"
    >
      <span className="mb-5 grid size-14 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-accent-foreground">
        <Check className="size-7" aria-hidden />
      </span>
      <h2 id={titleId} className="text-3xl font-medium">
        {labels.title}
      </h2>
      <p id={textId} className="mt-2 text-muted-foreground">
        {labels.text}
      </p>

      <div className="mt-6 rounded-md bg-background p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{labels.codeLabel}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="font-heading text-3xl font-semibold tracking-wider tabular-nums" data-testid="order-code">
            {code}
          </p>
          <button
            type="button"
            onClick={copy}
            className={cn(link, "min-h-11")}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{labels.saveHint}</p>
      </div>

      <p className="mt-6 text-sm font-medium">{labels.contactTitle}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`tel:${hotline.replace(/\s/g, "")}`} className={link}>
          <Phone className="size-4" aria-hidden />
          {labels.hotline}: {hotline}
        </a>
        <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className={link}>
          {labels.zalo}
        </a>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {orderHref && (
          <Link href={orderHref} className={primaryButton}>
            {labels.viewOrder}
          </Link>
        )}
        <Link href={productsHref} className={orderHref ? cn(link, "h-12") : primaryButton}>
          {labels.continue}
        </Link>
        <button type="button" onClick={() => ref.current?.close()} className={cn(link, "h-12")}>
          {labels.close}
        </button>
      </div>
    </dialog>
  );
}
