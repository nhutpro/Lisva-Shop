import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-sm border border-border bg-background px-4 text-base outline-none transition-shadow duration-300 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive";

type Props = {
  id: string;
  label: string;
  /** Text shown after the label for optional fields, e.g. "(optional)". */
  optionalLabel?: string;
  /** Translated error message, already looked up by the page. */
  error?: string;
  multiline?: boolean;
} & Omit<ComponentProps<"input">, "id" | "className">;

/** A labelled input or textarea with its error message linked for screen readers. */
export function CheckoutField({ id, label, optionalLabel, error, multiline = false, ...rest }: Props) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optionalLabel && <span className="ml-1.5 font-normal text-muted-foreground">{optionalLabel}</span>}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          name={rest.name}
          rows={3}
          maxLength={rest.maxLength}
          defaultValue={rest.defaultValue as string | undefined}
          className={cn(control, "min-h-24 py-3")}
        />
      ) : (
        <input {...rest} {...shared} className={cn(control, "h-12")} />
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
