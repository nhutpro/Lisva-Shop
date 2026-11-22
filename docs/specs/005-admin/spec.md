# 005 Admin: Spec

Status: **approved to build by the owner ("Help me build phrase 4 and phrase 5"); assumptions below were chosen by the assistant and can be changed**. Covers F09 (admin) from [SPEC.md](../../SPEC.md). Builds on [004-accounts](../004-accounts/spec.md) for sign-in and on the order rules of [001-database](../001-database/spec.md).

## Goal
The owner can handle order requests and manage the catalog without a developer: see new orders, call or message the customer, move each order through its statuses, record payment and shipping, and edit products, variants, stock and prices.

## Access
- Only users with role **ADMIN** can use `/[lang]/admin/*`. Everyone else (guests and customers) gets "not found", so the admin area is not advertised.
- Guests who open an admin address are sent to the login page; signed-in customers get the "not found" page.
- The first admin is created from the command line (`npm run admin:create -- <email>`); there is no public way to become an admin.
- Every admin page and every admin action re-checks the role on the server.

## Pages (under `/vi` and `/en`; all `noindex`)
| Route | Purpose |
|---|---|
| `/[lang]/admin` | Overview: counts and the newest orders |
| `/[lang]/admin/orders` | Order list with filters |
| `/[lang]/admin/orders/[code]` | One order: contact, items, status actions, shipping fee, payment, notes, history |
| `/[lang]/admin/products` | Product list with search and filters |
| `/[lang]/admin/products/new`, `/[lang]/admin/products/[id]` | Product editor |
| `/[lang]/admin/catalog` | Brands, categories and sizes |

## User stories and acceptance criteria
### Orders
1. The overview shows the number of **new** orders (not opened yet), orders waiting for contact, confirmed orders to ship, and variants that are low on stock, plus the latest orders.
2. The order list shows code, date, customer, phone, total and status; new orders have a visible "new" badge until the owner opens them; the list is newest first, and "only new orders" is a filter. I can filter by status, show only new orders, and search by code, name or phone (phone with or without spaces). 20 per page.
3. Opening an order marks it as seen (the badge disappears).
4. The order page shows the customer's phone as a one-tap call link and, when they prefer Zalo, a Zalo link; the address, the customer's note, the items exactly as ordered (name, color, size, SKU, price, quantity) and totals.
5. I can move the order to the next allowed status only (Chờ liên hệ, Đã liên hệ, Đã xác nhận, Đang giao, Hoàn thành, hoặc Đã hủy). Invalid moves are not offered and are refused by the server.
   - Confirming deducts stock once; cancelling a confirmed order restores it once (rules from spec 001). If stock is short, the move fails with a message naming the item and nothing changes.
   - Each change is recorded in the history with who made it and when.
6. I can set the shipping fee (whole VND); the total updates.
7. I can record that the customer paid (method and note); this does not change the delivery status.
8. I can add several private notes; they are never shown to the customer.

### Catalog
9. The product list shows name, brand, category, price, status, total stock and a low-stock mark; I can search, filter by status and category, and open an editor.
10. In the editor I can set: Vietnamese and English name and description, category, brand, price, original price (for sale display), status (draft, active, archived), featured, spec table rows (label and value in both languages), colors (name in both languages and a swatch), variants and photos.
    - **Variants are optional:** a product with no colors and no sizes has one default variant (SKU and stock only).
    - Each variant has color (optional), size (optional, from the shared size list), SKU, stock, optional own price, and an on/off switch.
    - Validation with clear messages next to the field: slug and SKU unique, no two variants with the same color and size, prices and stock whole numbers not below zero, original price not below the price.
    - Photos are added by address (an `https://` link or a `/path`), optionally tied to a color or to one variant, and can be reordered.
11. Saving updates the shop within a minute at most, and immediately for the admin (the shop's cached catalog is invalidated).
12. A product that appears in orders cannot be deleted, only archived (old orders keep their own copy of the data anyway). A product with no orders can be deleted.
13. Brands (name, SKU prefix), categories (Vietnamese and English name, optional parent) and sizes (type, label, order, foot length and US size for shoes) can be added and edited; a brand, category or size that is in use cannot be deleted.

### Cross-cutting
14. Vietnamese and English dictionaries with identical keys; mobile friendly (the owner will often use a phone); keyboard accessible; destructive actions ask for confirmation.
15. Customer phone numbers and addresses are never written to server logs.

## Assumptions (change by telling me)
- **Photos are links, not uploads:** uploading needs file storage (for example Cloudinary), planned separately. Until then you paste a link or put files in the project's `public/` folder.
- No charts, exports, bulk import or customer list yet (release 2 dashboard).
- Orders are confirmed manually; there is still no automatic payment.
- The admin interface follows the same visual system as the shop but is denser.

## Out of scope
Image upload, reports and charts, user management screens, emailing customers, shipping carrier integration, discount codes.

## Open questions
1. Should an admin be able to **edit an order's items** (for example change a size after a phone call)? (proposed: no for now; cancel and ask the customer to order again)
2. Do you want a second **staff** role with fewer rights (orders only)? (proposed: not now)

## Language rules (updated after review)
- Vietnamese and English are both required for product name, description, color names, spec rows and category names. Photo alt text stays optional.
- Optional help: when a DeepL key is configured, English left empty is translated from the Vietnamese when saving (the owner can still type or fix English). Without a key, or if DeepL fails or the quota is used up, the owner types the English and the form reports it as required.

## Photos (added after review)
- The owner can upload photos from their device (several at once, or replace one) or paste a link. JPG, PNG and WebP up to 5 MB; checked by content; only administrators can upload.
- The server sends the photo to Cloudinary (signed upload; the API secret never reaches the browser) and the database stores only the returned https address. Without Cloudinary settings, photos are saved in a local folder (development and self-managed servers).
- Not yet: deleting unused files from Cloudinary or the folder, resizing and compressing.
