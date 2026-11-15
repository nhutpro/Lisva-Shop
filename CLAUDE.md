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
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest; `npm run test:watch`)
- `npm run format`: Prettier
- Database (needs Docker running): `npm run db:up` / `db:down` (local Postgres), `db:migrate` (new migration after editing `prisma/schema.prisma`), `db:deploy` (apply existing), `db:seed` (fictional sample catalog; wipes catalog and orders, local DB only), `db:studio` (browse data)
- `npm test` needs the database up: DB tests run against the separate `lisva_test` database and refuse to run against anything else.

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
- The cart page (`/[lang]/cart`) does not exist yet (spec 003); links to it 404 until then.

## Environment notes
- Local Node is 20.13. Vitest is pinned to 4.x, Vite to 6.x and jsdom to 26 because newer versions need Node 22+. Upgrading Node to 22 LTS would lift these pins.
- `npm install` of dev tools may need `--legacy-peer-deps` (npm 10.5 crashes on some optional peer ranges).
