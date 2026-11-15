# 003 Cart and order request: Plan

Status: **implemented** (tasks 1-12 done; 238 tests passing; build, lint and typecheck clean; full flow verified in a real browser). Implements [spec.md](spec.md).

## What changed from the first plan
- Rate limiting runs **after** validation and counts only well-formed requests. The browser test showed that counting invalid submits would lock out a shopper who is fixing typos.
- `createOrderOnce` (returns `{ order, created }`) was added next to `createOrder`, so the alert is skipped for a repeated submit.
- A failure to schedule the alert is caught on its own, so it can never turn a saved order into an error for the shopper.
- `TELEGRAM_API_BASE_URL` (optional, for tests) lets the whole alert path be checked against a fake server.
- The migration was written from `prisma migrate diff` because `migrate dev` refuses to run without an interactive terminal.

## Known limitations
- **Telegram is not live until you set a bot token and chat id** (`.env`, see `.env.example`). Until then orders are saved and visible only in the database; there is no admin page yet (next phases).
- Rate limit is in server memory: it resets on restart and is not shared between instances.
- Address fields are free text; official province/district/ward dropdowns can come later.
- No order tracking page and no confirmation email; the order code and the shop's call are the customer's reference.
- Stock is checked, not reserved, at submit (as in spec 001).

## Verified in a real browser (production build, fake Telegram server)
Add a shoe with color and size and a watch with no options, edit quantities in the cart, submit an empty form (field messages in Vietnamese, focus moves to the summary), fix and send: pop-up with order code and hotline, Escape closes it, cart cleared, order row correct (status, normalized phone, snapshot lines and prices, no stock change), exactly one Telegram message with escaped customer text, a sold-out item blocks the order with a message naming the product and creates nothing, English pages, no console errors, no horizontal overflow at 390px. Not done: a manual screen-reader pass.

## Flow
```
Browser cart (variantId + quantity, localStorage)
   │  loadCartLines(ids)           server action, read only, no personal data
   ▼
Cart page / Checkout page (client)  ←  current names, prices, stock from the database
   │  submitOrder(formData)         server action
   ▼
 validate (Zod) → honeypot → rate limit → createOrder (transaction, idempotent)
   │                                         │
   │                                         └─ after commit: after(() => Telegram alert)
   ▼
 { ok: true, code }  or  { ok: false, error }   → dialog with order code, clear cart
```

## Data
- Migration: `Order.idempotencyKey String? @unique`. A random key is created when the checkout page opens and sent with the form. `createOrder` returns the existing order for a repeated key (also when two requests race: the unique constraint decides).
- No other schema change; `createOrder` already snapshots items and takes prices from the database.

## Server code
- `src/lib/catalog/cart-lines.ts`: `getCartLines(db, variantIds)` returns plain DTOs (name, brand, color, size, sku, unit price, stock, availability, photo). Unknown ids are simply absent.
- `src/lib/orders/submit-order.ts`: the testable core, `submitOrder(deps, input)`: honeypot, rate limit, `createOrder`, maps Zod and `OrderError` to a result `{ ok: true, code } | { ok: false, error: { code, fieldErrors?, variantId? } }`. Dependencies (db, limiter, clock, notify) are passed in.
- `src/lib/rate-limit.ts`: small in-memory sliding-window limiter (documented limits).
- `src/lib/telegram.ts`: typed client (`sendTelegramMessage`) with a 5 second timeout, HTML escaping, never throws, never logs the token; `formatOrderAlert(order)` is a pure function.
- `src/lib/env.ts`: Zod-validated optional variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`).
- `src/app/[lang]/checkout/actions.ts`: `"use server"`, thin: reads the form, the client address from request headers, calls `submitOrder`, schedules the alert with `after()`. `src/app/[lang]/cart/actions.ts`: `loadCartLines` with Zod-validated ids (max 30).

## Client code
- `src/lib/cart/use-cart-ready.ts`: tells components when the saved cart has been loaded (avoids a flash of "empty cart").
- `src/components/cart/cart-view.tsx`: lines, quantity stepper, remove, unavailable lines, totals, empty state.
- `src/components/cart/checkout-view.tsx`: form (`useActionState`), field errors, kept values, honeypot, submission key, summary, loading and error states.
- `src/components/cart/order-success-dialog.tsx`: native `<dialog>` opened with `showModal()` (focus trap, Escape, backdrop for free), order code with copy button, hotline and Zalo links.
- Pages `src/app/[lang]/cart/page.tsx` and `checkout/page.tsx` (static shells, `noindex`).
- Dictionaries: new `cart`, `checkout`, `orderSuccess` keys; error codes map to translated messages.

## Tasks
1. Spec and plan (this document).
2. Migration for `idempotencyKey`; `createOrder` idempotency with tests (repeat and race).
3. `getCartLines` with tests.
4. Telegram client and alert formatter with tests (fake fetch).
5. Rate limiter and env validation with tests.
6. `submitOrder` core with tests (validation, honeypot, limit, stock failure, idempotency, notify after success only).
7. Server actions.
8. Dictionary keys (vi, en).
9. Cart readiness hook; cart page and tests.
10. Checkout page, success dialog and tests.
11. Real browser check: product page to cart to checkout to success dialog; order exists in the database; Telegram path with a fake server.
12. Docs, `.env.example`, final lint, typecheck, tests, build.

## Risks
- In-memory rate limiting does not hold across server instances or restarts (documented; a shared store can replace it later).
- `after()` runs on the platform's max duration; a slow Telegram call must not matter (5 s timeout).
- React resets uncontrolled form fields after an action; the typed values are returned in the action state and used as default values so errors do not erase the form.
- Stock is checked, not reserved, at submit time (as decided in spec 001); the owner re-checks at confirmation.
