@AGENTS.md

# Lisva Shop

E-commerce site for watches and shoes, Vietnam market, Vietnamese first with an English switcher.

## Read first
- `docs/SPEC.md`: features, tech stack, phases, workflow.
- `docs/DESIGN.md`: the visual system (Soft Luxe). `docs/a1-soft-luxe.html` is the reference mockup.
- `docs/constitution.md`: non-negotiable rules.
- `docs/specs/<id>-<name>/`: per-feature `spec.md`, `plan.md`, `tasks.md`. Do not code a feature without an approved spec and plan.

## Commands
- `npm run dev`: dev server
- `npm run build`: production build
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest, all tests; `npm run test:watch`). `npm run test:unit`: unit and component tests, no database needed. `npm run test:integration`: `*.db.test.ts` files against `lisva_test` (needs `npm run db:up`). Name a test file `*.db.test.ts` when it uses the database.
- CI: `.gitlab-ci.yml` runs check (lint, typecheck) -> unit -> integration (Postgres service, integration tests, seed, build).
- `npm run format`: Prettier
- Database (needs Docker running): `npm run db:up` / `db:down` (local Postgres), `db:migrate` (new migration after editing `prisma/schema.prisma`), `db:deploy` (apply existing), `db:seed` (fictional sample catalog; wipes catalog and orders, local DB only), `db:studio` (browse data)
- Integration tests (and `npm test`) need the database up: they run against the separate `lisva_test` database and refuse to run against anything else.

## Stack
Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), lucide-react, Zod, Zustand (cart). Planned: PostgreSQL + Prisma, Auth.js, Telegram Bot API for order alerts, Claude API for AI features.

## This Next.js version is new: check the docs first
- Docs are bundled at `node_modules/next/dist/docs/`. Read the relevant guide before using an API.
- `middleware` is now `proxy` (`src/proxy.ts`).
- `cacheComponents` is on: runtime data (params, cookies, fetches) must be handled with Suspense or `"use cache"` as the docs describe.
- i18n is built in (no next-intl): routes live under `src/app/[lang]`, strings in `src/i18n/dictionaries/{vi,en}.json`, read with `getDictionary()` (Server Components) and passed to Client Components as props.

## Conventions
- All visible text goes in both dictionaries with identical keys. No hardcoded UI strings.
- Prices: `formatVnd()`, dates: `formatDate()` from `src/lib/format.ts`.
- Contact details (hotline, Zalo) come from `src/lib/site-config.ts` (currently placeholders).
- Server Components by default; `"use client"` only for interactivity.
- Validate every external input with Zod (forms, route handlers, webhooks).
- Use the design tokens in `src/app/globals.css`; do not invent colors or radii.
- Secrets only in `.env.local` (see `.env.example`); never commit them.

## Data layer (spec 001)
- Prisma **6.19** (Prisma 7 needs Node 22.18+). Schema: `prisma/schema.prisma`, diagram: `docs/specs/001-database/diagram.md`.
- Business logic lives in `src/lib/catalog/` and `src/lib/orders/`; functions take the Prisma client as the first argument. Use `db` from `src/lib/db.ts` in the app.
- Every product has at least one variant (a default variant when it has no options). Create products with `createProduct()`.
- Orders: `createOrder()` validates with Zod and takes prices from the database; stock is deducted only by `changeOrderStatus(..., "CONFIRMED")` and restored on cancel.
- The init migration contains hand-written SQL (CHECK constraints, a unique index that treats NULL color/size as equal, pg_trgm search index). Keep it when editing migrations. Check drift with `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (empty means in sync).
- `prisma migrate dev` can hang without a TTY when it wants to ask a question; read what it needs and run it in a terminal.

## Storefront (spec 002)
- Routes: `src/app/[lang]/` home, `products` (list, filters in the URL), `products/[slug]`; also `not-found.tsx`, `error.tsx`, a `[...rest]` catch-all that shows the localized 404, and `src/app/sitemap.ts` / `robots.ts`.
- Reads go through `src/lib/catalog/queries.ts` (cached with `'use cache'`, `cacheLife`, `cacheTag("products")`), which wrap the plain, tested functions in `queries-core.ts`. They return serializable DTOs (`types.ts`). Call `updateTag("products")` after admin edits or stock changes.
- `searchParams`/`params` are runtime values: read them inside `<Suspense>` (list page) or use `generateStaticParams` (product page). Client components that read the URL (`usePathname`, `useSearchParams`) must sit inside `<Suspense>`, or the build fails.
- List filters are a plain GET form; the query string is parsed by `parseListParams` (safe fallbacks) and built with `listParamsToSearch`.
- Variant picker rules are pure functions in `src/lib/catalog/variant-selection.ts`; the cart store (`src/lib/cart/store.ts`) holds only `{ variantId, quantity }` and is rehydrated by `CartHydrator`.
- `npm run build` needs the database running. Component tests need no extra setup (`vitest.setup.ts` cleans up after each test).

## Cart and order request (spec 003)
- Pages: `/[lang]/cart` and `/[lang]/checkout` (both `noindex`). No online payment in release 1: the shopper sends an order *request*, the owner is alerted on Telegram and contacts them.
- The browser cart holds only `{ variantId, quantity }`. `useCartLines()` (`src/lib/cart/use-cart-lines.ts`) joins it with current names, prices and stock from the `loadCartLines` server action (`getCartLines` in `src/lib/catalog/cart-lines.ts`), lowers quantities above stock, and flags lines that cannot be ordered.
- Sending an order: `submitOrderAction` (thin server action) calls `submitOrder` (`src/lib/orders/submit-order.ts`): honeypot, validation (Zod, field-level codes), rate limit (`src/lib/rate-limit.ts`, in memory, counts only well-formed requests), then `createOrderOnce`. It never throws; errors are `{ ok: false, error: { code, ... } }` and the page maps codes to translated text.
- `createOrderOnce` is idempotent through `Order.idempotencyKey` (random key per checkout visit): a repeat or a race returns the same order and `created: false`.
- Telegram: `src/lib/telegram.ts` (best effort, never throws, never logs the token) and `src/lib/orders/alert.ts`. The alert is scheduled with `after()` only for a newly created order. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (see `.env.example`); without them the alert is skipped and a warning is logged. `TELEGRAM_API_BASE_URL` points to a fake server for tests.
- The confirmation pop-up is a native `<dialog>` (`order-success-dialog.tsx`); the page keeps showing the confirmation behind it after the cart is cleared. jsdom lacks `showModal`, so `vitest.setup.ts` adds a small stand-in.
- Customer phone and address must never be written to server logs; Telegram messages (owner's private chat) are the only place they are sent.
- Tests: DB tests for `createOrderOnce`, `getCartLines` and `submitOrder`; component tests for the cart and checkout views. The full browser flow was verified with Playwright against a fake Telegram server (scripts were kept outside the repo).

## Accounts (spec 004)
- Pages: `/[lang]/login`, `register`, `account` (profile, password), `account/addresses`, `account/orders`, `account/orders/[code]`. Guests can still order. `src/proxy.ts` only redirects guests without the session cookie; the real check is `requireUser()` / `getCurrentUser()` in `src/lib/auth/current-user.ts` (call inside `<Suspense>`, and at the start of every server action).
- Passwords: scrypt (`src/lib/auth/password.ts`). Sessions: random token in the `lisva_session` cookie (httpOnly, SameSite=Lax), only its hash is stored. Changing the password signs out other devices. Login, registration and password change are rate limited (in memory, see `src/lib/rate-limit.ts`).
- Logic is in `src/lib/auth/` (functions take the Prisma client first). Server actions in `src/app/[lang]/account/actions.ts` are thin. Form errors are field codes mapped to dictionary text (`auth.fieldErrors`, `auth.formError`). `safeNextPath` only allows in-site `/vi` or `/en` paths.
- A form that saves data and then must show a changed list calls `refresh()` in the action. Do not call it for something that deletes the page being shown: redirect from the action instead.
- `getCurrentUser()` calls `connection()` before reading the clock; any `new Date()` on a request path needs the same care (Next reports it as an unstable prerender value).

## Admin (spec 005)
- Pages under `/[lang]/admin`: overview, `orders`, `orders/[code]`, `products`, `products/new`, `products/[id]`, `catalog` (brands, categories, sizes). Guests go to login; customers get "not found". Every admin action starts with `requireAdmin()`.
- Create the first admin from the terminal: `npm run admin:create -- email@example.com "Name"` (prints a generated password once; `ADMIN_PASSWORD` sets one; `--reset-password` for an existing account). Nothing in the website can grant the admin role.
- Logic is in `src/lib/admin/` (tested, takes the Prisma client). `saveProduct` writes product, colors, variants, specs and images in one transaction. Order status, stock and payment rules stay in `src/lib/orders/manage-order.ts`; stock is deducted only on CONFIRMED. A product that appears in orders cannot be deleted (set it to archived).
- Vietnamese and English are both required for product name, description, color names and spec rows, and for category names (alt text of photos stays optional). With `DEEPL_API_KEY` set (free keys end in `:fx`), English left empty is translated from the Vietnamese by DeepL *before validation* (`src/lib/admin/auto-translate.ts`, `src/lib/translate/deepl.ts`, source VI, target EN-US): English the owner typed is never changed, nothing is saved half-translated, and when there is no key, no quota (HTTP 456), or any other failure, the normal "required" message appears. Only texts are sent to DeepL. Whether DeepL supports Vietnamese was not confirmed from its docs: test with a real key; `DEEPL_SOURCE_LANG`/`DEEPL_TARGET_LANG` can change the codes. Editing the Vietnamese later does not re-translate English that already exists.
- Photos: the editor can upload from the device (`POST /api/admin/upload`, admin only, same-origin, JPG/PNG/WebP by content, max 5 MB) or take a link. The server saves through `getImageStorage()` (`src/lib/storage/index.ts`): **Cloudinary** when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are set (signed upload from the server, the secret never reaches the browser), otherwise a local folder (`UPLOAD_DIR`, default `.uploads/`, served by `/uploads/[name]`; fine for development or a VPS, not for serverless). The database keeps only the URL. Cloudinary pictures show through next/image for that account only; links to other sites need their host in `IMAGE_HOSTS`. Not done yet: deleting files when a photo is removed, resizing (Cloudinary can do it through URL transformations).
- After catalog or stock changes the actions call `updateTag("products")` so the shop shows the change at once. Photos are URLs (`https://...` or `/placeholders/...`); there is no upload yet.
- The product editor keeps a working copy in the browser; it is re-created after each save (`version` prop), and its "saved" notice lives in the wrapper so it survives that. The delete form must stay outside the editor `<form>` (forms cannot nest).

## Server entry points: review rules (senior-backend review, spec 005)
- Entry points are server actions (`account`, `admin`, `checkout`, `cart`) and two route handlers (`POST /api/admin/upload`, `GET /uploads/[name]`). Each starts with its own auth check, parses input with Zod or a strict pattern, calls a tested function, and maps typed errors to codes. Do not catch every error and call it "not found": map only known errors (`OrderError`, Prisma P2025/P2003) and rethrow the rest.
- Orders: shipping fee cannot change and payment cannot be recorded on a cancelled order (`ORDER_CLOSED`); shipping fee is also locked once completed; recording payment twice keeps the first record.
- Upload route: same-origin check (an unparsable `Origin` such as `null` is refused), admin only, `Content-Length` required (411 otherwise), size and content checks, storage failures logged without file data. A half-filled Cloudinary setup throws instead of silently using the local disk.
- `next.config.ts` sets security headers (nosniff, frame denial, referrer and permissions policies, HSTS in production). No full Content-Security-Policy yet (needs a nonce setup).
- Known limits: in-memory rate limiters, `x-forwarded-for` is only trustworthy behind a proxy, no file clean-up when photos are removed.

## Environment notes
- Local Node is 20.13. Vitest is pinned to 4.x, Vite to 6.x and jsdom to 26 because newer versions need Node 22+. Upgrading Node to 22 LTS would lift these pins.
- `npm install` of dev tools may need `--legacy-peer-deps` (npm 10.5 crashes on some optional peer ranges).
