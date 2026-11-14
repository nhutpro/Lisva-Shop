# 001 Database: Spec

Status: **approved by the owner and implemented**. Covers the data needed for release 1 (F01-F11 in [SPEC.md](../../SPEC.md)). Technology choices are in [plan.md](plan.md).

## Goal
Store products (watches and shoes) with optional color and size choices, and store order requests that the owner handles manually.

## User stories
1. As a shopper, I can pick a **size** and a **color** for a shoe, and see which combinations are in stock.
2. As a shopper, I can buy a watch that has **no options at all** (one tap, add to cart), or one with color/strap or case-size options.
3. As a shopper, I see the photos of the variant I chose (falling back to the color's photos, then the product's photos).
4. As a shopper, I can search with or without Vietnamese diacritics ("giay" finds "giày").
5. As a shopper, I submit an order request with my contact details and VN address, with no payment.
6. As the owner, I see each new order with the customer's phone, preferred contact method (phone or Zalo), the items, and I move it through statuses and add private notes.
7. As the owner, an order keeps showing what the customer saw when ordering, even if I later change a price or delete a product.

## Rules
### Products and variants
- **Variants are optional.** A product may have no colors and no sizes, only colors, only sizes, or both.
- Every product always has at least one sellable unit (a variant). A product with no options has one default variant. This means cart and orders always refer to a variant, with no special case.
- **Color** and **size** are the two option axes. Color has a Vietnamese name, an English name and a color swatch value. Size comes from a **shared size list** managed by the owner (not free text), so sizes are consistent and sort correctly. Each size has a type (shoe or watch), a label (e.g. `42`, `40mm`), a sort position, and for shoes optionally the foot length in cm and the US size, used for the size guide.
- A variant combination is unique per product (no two variants with the same color and size).
- Each variant has its own SKU, stock count (always tracked, no "unlimited stock" mode) and optional price. If a variant has no price, it uses the product's price.
- Sale display: a product can have a "compare at" (original) price higher than the selling price.
- A product can be Draft (hidden), Active, or Archived. Archived products stay in old orders but disappear from the shop.
- Images belong to the product, and can optionally be tied to a **specific variant** (e.g. Đen / 42) or to a **color** (shared by all sizes of that color, so the owner does not upload the same photo for every size). When the shopper chooses a variant, the shop shows variant photos first; if there are none, the color's photos; if there are none, the product's general photos.
- Product name, description, color names, category and brand names exist in Vietnamese and English. If English is missing, the site falls back to Vietnamese.
- Watches and shoes have a spec table (e.g. case size, movement, sole material), stored per product in both languages.
- Money is whole VND, never decimals.

### Categories and brands
- Categories: at least Đồng hồ (watches) and Giày (shoes); sub-categories allowed (e.g. Sneaker, Running).
- A product has exactly one category and exactly one brand. Lisva is the shop's name, not a brand: the shop resells third-party brands (e.g. Nike, Skechers for shoes; Casio, Seiko for watches), so brands are a separate table managed by the owner in admin. Shoppers can filter by brand.
- **SKU:** every variant has its own unique SKU (a code for one exact color and size, e.g. `NIKE-AZ-BLK-42`). A product with no options has one variant and so one SKU. Admin suggests a SKU from brand, product, color and size; the owner can edit it.

### Search
- Search matches name, brand and category, ignoring case and diacritics.

### Orders (release 1: order request, no payment)
- An order has a short unique **order code** shown in the pop-up (e.g. `LV-2611-7KQ2`).
- Guest orders are allowed. A logged-in user's orders are linked to the account.
- Stores: customer name, phone, optional email, preferred contact (phone or Zalo), VN address (province, district, ward, street), customer note, UI language.
- Statuses: Chờ liên hệ, Đã liên hệ, Đã xác nhận, Đang giao, Hoàn thành, Đã hủy. Payment is tracked separately by the owner (unpaid or paid, with method and note), so "paid" does not have to match the delivery status.
- Every status change is recorded (who, when, from, to).
- The owner can add several private notes to an order.
- The order shows as **new** until the owner opens it.
- Each order line is a **snapshot**: product name, color, size, SKU, unit price, quantity, image. It does not change if the product changes.
- Shipping fee is empty until the owner confirms it with the customer.
- **Stock** drops when the owner moves the order to Đã xác nhận, and returns if a confirmed order is cancelled. (Decision to confirm, see open questions.)

### Accounts (needed by F08)
- Users with email and password or Google login (handled by Auth.js), a role (customer or admin), and saved addresses.

### Cart
- The cart lives in the customer's browser in release 1 (survives reload). It is re-checked against current price and stock when the order is submitted. A server-side cart is not needed yet.

## Out of scope now (release 2)
Online payments, reviews, wishlist, coupons, shipping carrier data, product bundles, multiple warehouses. The model must not block adding them later.

## Acceptance criteria
- Given a shoe with colors Đen and Trắng and sizes 40-43, when I choose Đen and 42, then I get exactly one variant with its own stock and price.
- Given a watch with no options, then it has exactly one default variant and can be ordered directly.
- Given two variants with the same product, color and size, then the database rejects the second.
- Given sizes 9, 10 and 11 in the size list, then the shop shows them in numeric order.
- Given an order for size 42, when the size list entry is later renamed or removed, then the old order still shows size 42.
- Given a product price changes after an order, then the old order still shows the old price.
- Given a product is deleted or archived, then old orders still display correctly.
- Given the query `giay` or `dong ho`, then products named `Giày` or `Đồng hồ` are found.
- Given an order status change, then a history row records the old status, new status and time.
- Given a confirmed order is cancelled, then stock is restored once (never twice).
- Given a variant with its own photos, then the shop shows them; given a variant without photos but with a color that has photos, then the color's photos; otherwise the product's photos.
- Given a seed run, then the database contains realistic example watches and shoes in both languages, with and without variants.

## Decisions (answered by the owner)
1. **Stock timing:** stock drops when the owner confirms the order (Đã xác nhận), not when it is submitted. Known trade-off: two customers can request the last pair, and the owner resolves it when contacting them.
2. **Photos:** photos can be attached per variant. To avoid duplicate uploads, they can also be attached per color, with fallback order variant, color, product.
3. **Stock:** always tracked for every variant. No "made to order" mode.
4. **Brands:** the shop sells several third-party brands (Nike, Skechers, and others for watches). "Lisva" is the shop name only.
5. **Watch options:** watches can have both color (e.g. strap or dial color) and size (e.g. case size), same as shoes.
