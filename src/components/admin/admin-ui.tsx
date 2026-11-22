import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Issue } from "@/lib/admin/errors";
import { cn } from "@/lib/utils";

export const control =
  "w-full rounded-sm border border-border bg-background px-3 text-sm outline-none transition-shadow duration-300 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-destructive";

export const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors duration-300 hover:bg-gold hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-medium transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function Card({ title, id, children, className, action }: { title?: string; id?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section aria-labelledby={title ? id : undefined} className={cn("rounded-lg bg-surface p-5 shadow-soft sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 id={id} className="text-xl font-medium">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "alert" }) {
  const body = (
    <>
      <p className={cn("font-heading text-4xl font-semibold tabular-nums", tone === "alert" && value > 0 && "text-destructive")}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </>
  );
  const cls = "block rounded-lg bg-surface p-5 shadow-soft";
  return href ? (
    <Link href={href} className={cn(cls, "transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A labelled select with an optional error message. */
export function SelectField({
  id,
  label,
  error,
  children,
  hint,
  ...rest
}: { id: string; label: string; error?: string; hint?: string; children: ReactNode } & Omit<ComponentProps<"select">, "id" | "className">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...rest} className={cn(control, "h-11")}>
        {children}
      </select>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A labelled text input (or textarea) with an optional hint and error message. */
export function TextField({
  id,
  label,
  error,
  hint,
  multiline,
  ...rest
}: { id: string; label: string; error?: string; hint?: string; multiline?: boolean } & Omit<ComponentProps<"input">, "id" | "className" | "children">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={rest.name}
          rows={4}
          value={rest.value as string | undefined}
          defaultValue={rest.defaultValue as string | undefined}
          onChange={rest.onChange as unknown as ComponentProps<"textarea">["onChange"]}
          maxLength={rest.maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(control, "min-h-24 py-2.5")}
        />
      ) : (
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} className={cn(control, "h-11")} />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The translated text for an issue code, or undefined. */
export const issueText = (code: string | undefined, texts: Record<string, string>) => (code ? (texts[code] ?? texts.invalid) : undefined);

export const issueFor = (issues: Issue[] | undefined, path: string) => issues?.find((i) => i.path === path)?.code;

/** Link to another page of a filtered list, keeping the filters. */
export function pageHref(base: string, params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  if (page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `${base}?${s}` : base;
}

export function Pager({
  base,
  params,
  page,
  pageCount,
  labels,
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  labels: { previous: string; next: string; page: string };
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={labels.page} className="mt-6 flex items-center justify-center gap-3">
      {page > 1 && (
        <Link href={pageHref(base, params, page - 1)} rel="prev" className={ghostButton}>
          {labels.previous}
        </Link>
      )}
      <span className="text-sm text-muted-foreground">{labels.page}</span>
      {page < pageCount && (
        <Link href={pageHref(base, params, page + 1)} rel="next" className={ghostButton}>
          {labels.next}
        </Link>
      )}
    </nav>
  );
}
