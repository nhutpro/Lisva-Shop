# 004 Customer accounts: Plan

Status: **built and verified** (unit, database and browser tests). Implements [spec.md](spec.md). Follows `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

## How sessions fit Cache Components
- Reading the session needs `cookies()`, a runtime value. Pages are static shells; everything that reads the user sits inside `<Suspense>` and resolves `getCurrentUser()` there. No session read at the top level of a layout.
- `src/proxy.ts` does a cheap first gate (no database): `/account/*` and `/admin/*` without a session cookie redirect to login with a safe `next`. The real check is always in the page or action.
- Session-derived data is not cached in this phase (it is small and per user).

## Server code (`src/lib/auth/`)
- `password.ts`: `hashPassword` / `verifyPassword` with `crypto.scrypt` (N=2^15, r=8, p=3), format `scrypt$N$r$p$salt$hash` so the cost can change later; constant-time compare; a dummy hash is checked for unknown emails to even out timing.
- `session.ts`: `createSession(db, userId)` returns a random token and stores `sha256(token)` in `Session.sessionToken`; `getSessionUser(db, token)`; `revokeSession`; `revokeOtherSessions`; expiry handling.
- `schemas.ts`: Zod schemas (register, login, profile, password, address) with field-level error codes, shared mapping to `FieldErrors` like checkout.
- `service.ts`: `registerUser`, `authenticate` (never says which part was wrong), `updateProfile`, `changePassword`.
- `addresses.ts`: `listAddresses`, `saveAddress`, `deleteAddress`, `setDefaultAddress`; every function takes the `userId` and filters by it.
- `orders.ts`: `listUserOrders` (paged), `getUserOrder(db, userId, code)` returning a customer-safe shape (no internal notes, no payment note).
- `current-user.ts` (Next-specific): reads the cookie, wraps `getSessionUser` with React `cache`, `requireUser()` redirects to login.
- `cookie.ts`: names and options in one place.
- Rate limits: reuse `createRateLimiter` for login (per email and per address) and registration.

## UI
- Pages as above, each a static shell with the content in `<Suspense>`.
- `AccountMenu` (header): server component inside `<Suspense>` with a static fallback link.
- Forms use `useActionState` and keep typed values on error (same pattern as checkout); server actions are thin and call the service.
- Checkout: a server action `loadCheckoutDefaults` returns the signed-in user's name, phone, email, addresses (nothing for guests); `submitOrderAction` reads the current user so the order gets `userId`, and optionally saves the address.

## Tasks
1. Spec and plan (this document).
2. Password hashing and session core with tests (cheap scrypt parameters in tests).
3. Auth schemas, `registerUser`, `authenticate`, profile and password with tests, including enumeration, rate limits and "other sessions signed out".
4. Address book core with ownership tests.
5. User order history core with tests (isolation between users, no internal data).
6. Current user, cookie handling, proxy gate, server actions.
7. Dictionary keys (vi, en).
8. Pages: login, register, account, addresses, orders, order detail; header account menu.
9. Checkout integration (defaults, saved addresses, link order to the account, save address).
10. Component tests for the forms; real browser check; docs.

## Risks
- Hand-written authentication is easy to get subtly wrong: mitigated by using only vetted primitives (`scrypt`, `randomBytes`, `timingSafeEqual`, SHA-256), tests for the security rules above, and keeping it small.
- In-memory limits do not cover several server instances.
- No password reset until email exists.
