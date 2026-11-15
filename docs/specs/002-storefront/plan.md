# 002 Storefront: Plan

Status: **implemented** (tasks 1-12 done; 158 tests passing; build, lint and typecheck clean). Implements [spec.md](spec.md).

## What changed from the first plan
- The product page uses `generateStaticParams` (all active products are prerendered, new ones render on first request) and checks the product before anything streams. Reason: with Cache Components, `params` must otherwise be read inside `<Suspense>`. An empty catalog uses a placeholder sample so the build still passes (verified against an empty database).
- Header parts that read the URL (`usePathname`, `useSearchParams`) sit inside `<Suspense>` with static fallbacks; the build failed without this on dynamic routes.
- The list page's `<h1>` is in the static shell; the count, sort, filters and grid stream in.
- Variant pickers use native radio inputs (keyboard behavior and disabled states for free).

## Known limitations
- **Soft 404 for unknown products:** `dynamicParams` is not available with Cache Components, so `/products/<unknown>` shows the not-found page with `noindex` but HTTP status 200. Unknown pages elsewhere return a real 404.
- **Build needs the database:** home, list facets, product pages and the sitemap read the database at build time (`npm run db:up` first). Content refreshes within about a minute after a cache expiry; `updateTag("products")` will invalidate it on admin edits (admin phase).
- **Cart link:** the header and the "view cart" link point to `/[lang]/cart`, which does not exist until spec 003 (currently a 404).
- **Photos:** placeholder drawings; the mixed size filter lists shoe and watch sizes together when no category is chosen.
- Price filter and sorting use the product's base price, not variant overrides (as in the spec).

## Verified
Pages checked in headless Chrome at 1280px and a true 390px frame (no horizontal overflow, no console errors on 8 page types), in `/vi` and `/en`; filters, search, sort, empty state and invalid query strings return 200; sitemap and robots respond. Not yet done: a manual keyboard-only and screen-reader pass.

## Data access and caching (Next.js 16 with `cacheComponents`)
- `src/lib/catalog/queries-core.ts`: plain functions `(db, args) => plain data`. Return only serializable DTOs (no `Decimal`, no class instances). Fully testable against `lisva_test`.
- `src/lib/catalog/queries.ts`: thin `'use cache'` wrappers that call the core functions with the shared `db`, each with `cacheLife('minutes')` and `cacheTag('products')`. Arguments (filters, page) become the cache key. When admin edits or orders confirm stock, `updateTag('products')` invalidates them (wired in the admin phase).
- Pages: `searchParams` and `params` are runtime APIs, so the page shell is static and the data part sits inside `<Suspense>` with a skeleton. Cached functions never read runtime APIs; values are passed as arguments.
- Query-string parsing is a pure, tested function (`parse-list-params.ts`) using Zod with safe fallbacks.

## DTOs
- `ProductCardData`: id, slug, nameVi/nameEn, brand name, category slug, base price, from-price, `priceVaries`, compareAtPrice, image (url, alt vi/en), color swatches, `inStock`.
- `ProductDetailData`: card fields plus descriptions, specs, colors, sizes (label, type, foot length as number, US size), variants (id, sku, colorId, sizeId, effective price, stock), images (with variantId/colorId/position).
- `ListFacets`: brands, sizes, colors, price bounds for the current category.

## Variant selection logic (pure, tested)
`src/lib/catalog/variant-selection.ts`: given variants and the chosen color and size: which colors and sizes are selectable, the matching variant, a stock state, and missing-option message. Handles products with no color, no size, or neither.

## Cart
`src/lib/cart/store.ts`: Zustand with persist; items are `{ variantId, quantity }` only (max 20 per line, merges lines). The header count reads it with a selector. Prices and names are never stored.

## Files
- `src/app/[lang]/layout.tsx` (+ header and footer), `page.tsx` (home), `products/page.tsx`, `products/[slug]/page.tsx`, `not-found.tsx`, `sitemap.ts`
- `src/components/site/`: header, mobile menu, search form, cart link, footer
- `src/components/shop/`: product card, grid, filters form, sort links, pagination, gallery + purchase panel (client), variant picker, add to cart, spec table, size guide, trust row, hero watch
- `src/lib/catalog/*`, `src/lib/cart/store.ts`
- Dictionaries: new keys in `vi.json` and `en.json`

## Client components (only the interactive leaves)
Mobile menu, cart link (count), purchase panel (gallery, picker, add to cart), hero watch (ticking hands, static under reduced motion).

## Tasks
1. Spec and plan (this document).
2. Dictionary keys (vi, en).
3. Core queries and facets with DB tests; list-params parser with tests.
4. Cached wrappers.
5. Variant-selection logic and cart store with tests.
6. Site chrome: header (search, language, cart count, mobile menu), footer.
7. Home page.
8. Product list page (filters, sort, pagination, skeleton, empty state).
9. Product detail page (gallery, picker, price, stock, specs, size guide, add to cart, JSON-LD).
10. Not found page, metadata, hreflang, sitemap.
11. Component tests (variant picker, add to cart, list).
12. Verify: lint, typecheck, tests, build; open pages in a browser at 390px and 1280px in both languages; keyboard pass.

## Risks
- Prisma inside Next.js with Turbopack and `cacheComponents` is new in this repo: verify with an early build.
- Cached stock may be a few minutes old; mitigated by the order request re-check.
- Placeholder drawings make the product grid look repetitive until real photos exist.
