export const SESSION_COOKIE = "lisva_session";

/** One place for the cookie settings: not readable by scripts, not sent from other sites' forms, HTTPS only in production. */
export const sessionCookieOptions = (expires: Date) =>
  ({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  }) as const;
