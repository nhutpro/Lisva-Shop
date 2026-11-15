export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** "/vi/products" for localePath("vi", "/products"). Always use this for internal links. */
export const localePath = (locale: Locale, path = ""): string => `/${locale}${path}`;
