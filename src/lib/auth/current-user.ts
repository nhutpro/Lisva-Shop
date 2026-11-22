import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { localePath, type Locale } from "@/i18n/config";
import { db } from "../db";
import { SESSION_COOKIE } from "./cookie";
import { getSessionUser, type SessionUser } from "./session";

// The Data Access Layer for "who is signed in". Reading it needs the request's cookies, so it can only be
// called inside <Suspense> in pages (see node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md)
// and always at the start of a server action. Never trust the UI to hide things: check here.

export const getSessionToken = async () => (await cookies()).get(SESSION_COOKIE)?.value;

/** The signed-in user or null. Cached for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getSessionToken();
  // Session expiry compares with the current time, which must be read at request time, never while prerendering.
  await connection();
  return getSessionUser(db, token);
});

/** The signed-in user; guests are sent to the login page and back afterwards. */
export async function requireUser(locale: Locale, nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`${localePath(locale, "/login")}${next}`);
  }
  return user;
}

/** An administrator. Everyone else (guests and customers) gets the "not found" page, so the area is not advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  return user;
}
