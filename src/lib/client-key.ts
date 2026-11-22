import { headers } from "next/headers";

/**
 * Identifies the client for rate limiting: the first address in `x-forwarded-for` (set by the hosting
 * proxy), else `x-real-ip`. Behind no proxy these headers can be forged, so treat limits as a speed bump.
 */
export async function getClientKey(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
}
