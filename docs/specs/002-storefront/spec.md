# 002 Storefront: Spec

Status: **implemented; approved to build by the owner ("move on to phase 2 and build"). Assumptions below were chosen by the assistant and can be changed. See plan.md for known limitations (notably: unknown product URLs return 200 with noindex, and the cart page comes in spec 003).** Covers F01 (catalog), F02 (product detail), F03 (search) and the home page from [SPEC.md](../../SPEC.md). Data model: [001-database](../001-database/spec.md). Look and feel: [DESIGN.md](../../DESIGN.md), mockup [a1-soft-luxe.html](../../a1-soft-luxe.html).

## Goal
Shoppers can browse watches and shoes, filter and search them, open a product, choose color and size, and see price, stock and photos for the exact variant. Add to cart works and the header shows the count. The cart page and order request come in spec 003.

## Pages (all under `/vi` and `/en`)
| Route | Purpose |
|---|---|
| `/[lang]` | Home: hero, category tiles, featured products, new arrivals, trust row, footer |
| `/[lang]/products` | Product list with search, filters, sort, pagination |
| `/[lang]/products/[slug]` | Product detail |
| Not found | Friendly 404 page for unknown products or routes |

## User stories and acceptance criteria
### Home
1. As a shopper I see the two categories, featured products and the shop's trust promises immediately, on a phone first.
   - Given the home page, then category tiles link to the list filtered by that category, and featured products come from the database.

### Product list (F01)
2. I can narrow by **category**, **brand**, **price range**, **size** and **color**, and sort by newest, price low to high, price high to low.
   - Given filters in the URL, then the list, the filter controls and the result count all reflect them, and the URL can be shared or bookmarked.
   - Given no results, then an empty state explains and offers to clear filters.
   - Given more than 12 products, then pagination links appear and the page number is in the URL.
   - Given an invalid or malicious query string (negative page, unknown sort, huge numbers), then the page falls back to safe defaults and does not error.
3. Each product card shows photo, brand, name, price (with "from" when variants differ), original price and sale badge when on sale, color swatches, and "sold out" when no variant is in stock.

### Search (F03)
4. I can type in the header search box and get matching products.
   - Given the query `giay` or `dong ho` with or without diacritics, then matching products are found (spec 001 rules). Every word must match.
   - Given a query combined with filters, then both apply.

### Product detail (F02)
5. I see a photo gallery, brand, name, price, description and a spec table.
6. I choose **color** and **size** only if the product has them (variants are optional).
   - Given a product without options, then no pickers are shown and "Add to cart" works directly.
   - Given color and size pickers, then combinations that do not exist or have no stock are disabled, and choosing a color or size updates price, stock message, SKU and photos.
   - Photos follow the rule: the variant's own photos, else the color's, else the product's general photos.
   - Given no variant selected yet, then "Add to cart" asks the shopper to choose the missing option instead of failing silently.
   - Given a variant with its own price, then that price is shown, otherwise the product price.
7. Stock message: in stock, "only N left" when 5 or fewer, or sold out. The exact numbers can be slightly out of date (cached up to a few minutes); the order request re-checks stock.
8. Shoes show a size guide (foot length in cm and US size) for the sizes available.
9. Add to cart stores the variant and quantity in the browser, shows a confirmation announced to screen readers, and the header cart count updates. The cart page itself is spec 003.

### Cross-cutting
10. Every text is in Vietnamese and English dictionaries with identical keys; prices use VND format; the language switcher keeps the current path and query.
11. Mobile first (390px) and desktop (1280px); keyboard accessible; respects reduced motion.
12. SEO: page titles and descriptions from product data, `hreflang` alternates, JSON-LD `Product` on the detail page, a sitemap of products and categories.
13. Performance: images have fixed aspect ratios (no layout shift); only the LCP image is prioritized; the home and list shells render without waiting for data.

## Assumptions (change by telling me)
- Price filter and "price sort" use the product's base price; a variant's own price override is shown on the detail page but does not affect sorting.
- Size and color filters match products that have an active variant with that size or color name.
- 12 products per page. Sort default is newest.
- Placeholder drawings are used for product photos until real photos exist.
- Search is a plain form (works without JavaScript); filters are a plain GET form too.
- Add to cart only; the cart page, quantity editing and the order request are spec 003.

## Out of scope
Cart page and order request (spec 003), accounts, reviews, wishlist, recommendations, admin.

## Open questions
1. Do you want a **brand filter** to allow several brands at once (proposed: yes) or one?
2. Should sold-out products be **hidden** from the list or shown with "sold out" (proposed: shown)?
3. Footer content: shop address, opening hours and social links are placeholders for now.
