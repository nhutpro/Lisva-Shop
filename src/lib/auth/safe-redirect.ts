import { locales } from "@/i18n/config";

const MAX_LENGTH = 300;

/**
 * Returns `next` only when it is a path inside this site and inside a language section
 * ("/vi/..." or "/en/..."); otherwise null. Never lets a sign-in redirect to another website.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > MAX_LENGTH) return null;
  // Must start with a single slash: "//evil.com", "/\\evil.com" and "https://evil.com" are refused.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  // No control characters (header injection) and no embedded scheme tricks.
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;

  let url: URL;
  try {
    url = new URL(next, "http://site.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://site.invalid") return null;

  const [, section] = url.pathname.split("/");
  if (!(locales as readonly string[]).includes(section)) return null;
  return `${url.pathname}${url.search}`;
}
