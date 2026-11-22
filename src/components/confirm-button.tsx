"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"button">, "type" | "onClick" | "children"> & {
  /** Text of the first button, e.g. "Delete". */
  label: string;
  /** Text after the first click, e.g. "Yes, delete". The second click submits the form. */
  confirmLabel: string;
};

/**
 * A submit button that needs two clicks, so a destructive action cannot happen by accident.
 * After the first click it asks to confirm and drops the request again after a few seconds.
 */
export function ConfirmButton({ label, confirmLabel, className, ...rest }: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      {...rest}
      type={armed ? "submit" : "button"}
      onClick={(event) => {
        if (armed) return; // second click: let the form submit
        event.preventDefault();
        setArmed(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setArmed(false), 4000);
      }}
      onBlur={() => setArmed(false)}
      aria-live="polite"
      className={cn(className, armed && "border-destructive bg-destructive text-white hover:bg-destructive hover:text-white")}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
