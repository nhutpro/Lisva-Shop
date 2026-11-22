import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const SECTIONS = new RegExp(`^/(${locales.join("|")})/(account|admin)(/|$)`);

// 1. Visitors without a language prefix land on /vi (Vietnam-first shop).
// 2. Account and admin pages need a session cookie. This is only a quick first gate that sends guests to the
//    login page (and back afterwards); whether the session is real, and whether the person is an admin, is
//    checked on the server in every page and action.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));

  if (!hasLocale) {
    request.nextUrl.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  const section = SECTIONS.exec(pathname);
  if (section && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${section[1]}/login`;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Skip Next internals, API routes and files with an extension (images, favicon...).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
