# 003 Cart and order request: Spec

Status: **implemented; approved to build by the owner ("Help me implement phase 3"). Assumptions below were chosen by the assistant and can be changed. See plan.md for known limitations (notably: the Telegram alert needs your bot token and chat id).** Covers F04 (cart), F05 (order request) and the order-creation and owner-alert parts of F07 from [SPEC.md](../../SPEC.md). Data model and order rules: [001-database](../001-database/spec.md). Storefront: [002-storefront](../002-storefront/spec.md).

## Goal
A shopper can review the cart, send an order **request** with contact details and address, and sees a confirmation pop-up with an order code. There is **no online payment**: the owner is alerted on Telegram, contacts the customer by phone or Zalo, and handles the rest manually (admin comes in a later phase).

## Pages (under `/vi` and `/en`)
| Route | Purpose |
|---|---|
| `/[lang]/cart` | Review and edit the cart |
| `/[lang]/checkout` | Order request form, order summary, confirmation pop-up |

Both are excluded from search engines (`noindex`).

## User stories and acceptance criteria
### Cart (F04)
1. As a shopper I see each cart line with photo, name, brand, color, size, unit price, quantity and line total, using **current** prices and names from the shop (never values stored in the browser).
   - Given a cart saved earlier and a price that changed since, then the page shows the new price.
2. I can change the quantity (1 up to the available stock, at most 20) and remove a line. The header count and totals update immediately, and the cart survives a reload.
3. Lines that cannot be bought (variant switched off, product hidden or deleted, sold out) are clearly marked, do not count in the total, and block checkout until removed.
   - Given a quantity above the current stock, then it is lowered to the stock and the shopper is told.
4. Empty cart: a friendly message and a link to the products.
5. Totals: subtotal, shipping shown as "to be confirmed when we contact you", and an estimated total.

### Order request (F05)
6. I fill in: full name, phone, optional email, preferred contact (phone or Zalo), province/city, district, ward, street address, optional note. No payment step.
   - Given invalid or missing fields, then each problem is shown next to its field in my language, and what I typed is kept.
   - Phone numbers are accepted as `0912 345 678`, `+84 912 345 678` or `84912345678` and stored as `0912345678`.
7. On submit the order is saved with status "Chờ liên hệ", a short order code, and a snapshot of the items and prices **taken from the database**.
   - Given an item sold out or no longer available at submit time, then no order is created and the shopper sees which item to fix; the cart is updated.
   - Given a double click, a retry, or a repeated request with the same submission key, then only one order exists.
   - Given a bot filling the hidden trap field, then no order is created and nothing visible happens.
   - Given too many requests from one address in a short time, then the shopper sees a polite "try again later" message and nothing is created.
8. After success a pop-up (modal dialog) thanks the shopper, shows the **order code**, says the shop will contact them to confirm, and shows the hotline and Zalo link. The cart is cleared. The dialog is keyboard accessible (focus is trapped, Escape closes) and announces itself to screen readers.
9. The owner gets a Telegram message for every new order (code, name, phone, preferred contact, address, items with sizes and colors, subtotal, note). It is sent **after** the order is saved; if Telegram is not configured or fails, the order is still saved and the shopper sees success.

### Cross-cutting
10. All text in Vietnamese and English dictionaries with identical keys; prices in VND; links keep the language.
11. Mobile first (390px) and desktop; keyboard accessible; reduced motion respected.
12. Secrets (Telegram token and chat id) only in environment variables. Customer phone and address are never written to server logs.

## Assumptions (change by telling me)
- Address fields are free text (province, district, ward, street) for now; dropdowns from official Vietnamese administrative data can come later.
- Email is optional and no email is sent in release 1.
- Guest orders only (accounts come later); no order tracking page; the order code and the shop's call are the customer's reference.
- Rate limit: 5 well-formed order requests per 10 minutes per address (requests with validation errors are not counted, so fixing typos never locks a shopper out), kept in server memory (it resets on restart and is per server instance).
- Telegram needs your bot token and chat id; until they are set the alert is skipped (clearly reported in the server log), and orders are only visible in the database (admin comes later).
- Maximum 20 per line and 30 lines (as in the order input rules).
- Shipping fee is not shown as a number: the owner quotes it when contacting the customer.

## Out of scope
Admin order management, online payments, order emails, order tracking, accounts and saved addresses.

## Open questions
1. Do you want province/district/ward **dropdowns** now (more work, needs the official list) or free text first (proposed)?
2. Should email be **required**? (proposed: optional)
3. Telegram: you must create the bot with BotFather and give me the token and chat id (I will explain), or leave it for later.
