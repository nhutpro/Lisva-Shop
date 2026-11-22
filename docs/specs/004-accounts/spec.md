# 004 Customer accounts: Spec

Status: **approved to build by the owner ("Help me build phrase 4 and phrase 5"); assumptions below were chosen by the assistant and can be changed**. Covers F08 (accounts) and the order-history part of F07 from [SPEC.md](../../SPEC.md). Builds on [001-database](../001-database/spec.md) (User, Address, Session, Order) and [003-cart-order](../003-cart-order/spec.md).

## Goal
Customers can create an account, sign in, keep a profile and an address book, and see their orders and their status. Checkout becomes faster and orders are linked to the account. **Guests can still order without an account.**

## Pages (under `/vi` and `/en`; all `noindex`)
| Route | Purpose |
|---|---|
| `/[lang]/register`, `/[lang]/login` | Create an account, sign in |
| `/[lang]/account` | Profile and password |
| `/[lang]/account/addresses` | Address book |
| `/[lang]/account/orders` | Order history |
| `/[lang]/account/orders/[code]` | One order: items, address, status timeline |

## User stories and acceptance criteria
### Register and sign in
1. I can register with full name, email, password (8 to 128 characters) and an optional phone number.
   - Emails are compared without caring about upper/lower case. A second account with the same email is refused with a clear message next to the email field.
   - A weak or empty password, a malformed email or phone shows field messages in my language and keeps what I typed.
   - After registering I am signed in and sent to my account (or to the page I came from).
2. I can sign in with email and password.
   - A wrong password and an unknown email give the **same** message, so nobody can find out which emails have accounts.
   - After 5 failed attempts for the same email or the same address within 10 minutes, further attempts are refused for a while with a polite message.
   - A `next` address is followed only when it is a path inside this site (never another website).
3. I can sign out; the session ends on the server too.

### Sessions (security)
4. The session token is random (256 bits). Only its SHA-256 hash is stored in the database. The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, valid 30 days.
5. Passwords are stored only as salted `scrypt` hashes (the parameters are stored with the hash so they can be raised later). Plain passwords never appear in logs.
6. Changing the password signs out all other sessions. Expired sessions are ignored and removed.
7. Every protected page and every action re-checks the session on the server; hiding a link is never the protection.

### Account area
8. The header shows "Đăng nhập" for guests, or my name with a menu (Account, Orders, Sign out) when signed in. Admins also see "Quản trị".
9. Profile: I can change my name and phone, and my password (I must give the current one).
10. Address book: add, edit, delete and choose a default address (recipient name, phone, province, district, ward, street); at most 10; I can only see and change my own.
11. Checkout when signed in: name, phone, email and default address are filled in, I can pick another saved address, and I can tick "save this address". The order is linked to my account.
12. Order history: my orders (newest first, 10 per page) with code, date, status, total and item count. An order page shows items (as ordered), address, shipping fee when known, payment status and a status timeline.
    - Another customer's order, or an unknown code, shows "not found". Internal notes and payment notes are never shown.
13. Guest orders stay guest orders (they do not appear in any account).

### Cross-cutting
14. Vietnamese and English dictionaries with identical keys; mobile first; keyboard accessible (labels, error messages linked to fields, focus on the problem summary).
15. Customer data is never written to server logs.

## Assumptions (change by telling me)
- **Own session code, no Auth.js:** the project's Next.js is very new and Auth.js v5 is still beta, so sessions are built with Node's built-in `crypto` (scrypt, random tokens) and the existing `Session` table. No new dependency.
- Email is not verified and there is **no password reset** (both need email sending, planned for release 2). A customer who forgets the password contacts the shop.
- **No Google login** for now (needs an OAuth application from you).
- Login limits are kept in server memory (reset on restart, per instance), like the order limit.
- The shop's currency, formats and dictionary rules apply as everywhere else.

## Out of scope
Email verification, password reset, social login, saved payment methods, wishlist, reviews, merging past guest orders into a new account.

## Open questions
1. Do you want customers to be able to **cancel** an order themselves while it is still "Chờ liên hệ"? (proposed: no, they call the shop)
2. Is a **phone number required** at registration? (proposed: optional; checkout asks for it anyway)
