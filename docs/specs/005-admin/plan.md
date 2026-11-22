# 005 Admin: Plan

Status: **built and verified** (unit, database and browser tests). Implements [spec.md](spec.md). Depends on spec 004.

## Architecture
- Admin pages are static shells with the content behind `<Suspense>`; the inner component calls `requireAdmin()` (session read, role check, "not found" for non-admins). Admin server actions call `requireAdmin()` first, then a domain function.
- Domain code lives in `src/lib/admin/` as plain functions taking the Prisma client (tested against the test database); actions are thin.
- Order status, stock and payment rules already exist in `src/lib/orders/manage-order.ts`; admin adds queries (list, detail, counts) and wires actions to them. Every change goes through those functions so the stock rules cannot be bypassed.
- After any change to products, stock or reference data an action calls `updateTag("products")` (and `"categories"` when categories change). Order confirmation and cancellation also change stock, so they call it too.

## Server code (`src/lib/admin/`)
- `orders.ts`: `listAdminOrders(db, { status, onlyNew, q, page })`, `getAdminOrder(db, code)` (with items, history, notes, payment), `getOrderCounts(db)`, `getLowStock(db)`; opening marks the order seen.
- `product-schema.ts`: Zod schema for the editor payload (nested colors, variants, specs, images with client keys), shared by client and server.
- `products.ts`: `listAdminProducts`, `getAdminProduct`, `saveProduct(db, input)` (create or update in one transaction; maps temporary client keys to ids; deletes removed variants, colors and images in a safe order; recomputes `searchText`), `deleteProduct` (only without orders), `adjustStock`.
- `reference-data.ts`: brands, categories and sizes: list, create, update, delete (refused when in use, with a reason).
- `errors.ts`: typed `AdminError` codes (`SLUG_TAKEN`, `SKU_TAKEN`, `DUPLICATE_VARIANT`, `IN_USE`, `NOT_FOUND`, ...) mapped to messages by the UI.
- `src/lib/auth/guards.ts`: `requireAdmin()` for pages and actions.
- `scripts/create-admin.ts` and `npm run admin:create`: creates or promotes a user; uses `ADMIN_PASSWORD` when set, otherwise generates a strong password and prints it once.

## UI (`src/components/admin/`, `src/app/[lang]/admin/`)
- `AdminShell` (sidebar on desktop, top bar on phones), overview, order list with filters and pagination, order detail with action forms, product list, product editor (client component holding the draft, JSON payload to one server action), catalog pages.
- Reuses the shop's tokens and form components; dense tables become cards on small screens.

## Tasks
1. Spec and plan (this document).
2. Guards, `create-admin` script and tests.
3. Order admin core (list, detail, counts, seen) with tests.
4. Product schema and `saveProduct` with tests (variants optional, key mapping, uniqueness, deletion rules, stock rules).
5. Reference data core with tests.
6. Server actions (role check first, cache invalidation).
7. Dictionary keys (vi, en).
8. Admin shell, overview, orders pages.
9. Order detail actions UI.
10. Product list and editor UI.
11. Catalog pages.
12. Real browser run (sign in as admin, process an order end to end, edit a product and see it in the shop), final checks, docs.

## Risks
- The product editor is the largest piece (nested variants, photos tied to colors or variants): covered by core tests and a browser run.
- The in-memory caches mean a change can take up to a minute to appear for shoppers on other instances (the admin sees it immediately).
- Without file upload, photos depend on external links staying alive.
