import type { Locale } from "./config";

/** Fills "{name}" placeholders: format("Còn {count}", { count: 3 }) -> "Còn 3". Unknown placeholders stay as written. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Database content is stored in Vietnamese with an optional English version; English falls back to Vietnamese. */
export function pick(locale: Locale, vi: string, en?: string | null): string;
export function pick(locale: Locale, vi: string | null | undefined, en?: string | null): string | null;
export function pick(locale: Locale, vi: string | null | undefined, en?: string | null): string | null {
  if (locale === "en" && en) return en;
  return vi ?? null;
}
