# Lisva Shop: Product Spec and Build Flow

Watches and shoes e-commerce, Vietnam market, Vietnamese first with an English switcher. Visual style: [DESIGN.md](DESIGN.md).

## 1. Goals
- Sell watches and shoes online to customers in Vietnam.
- Mobile-first. Fast, trustworthy, beautiful.
- Release 1: customers place an order request, and the shop contacts them to confirm and collect payment manually (no online payment).
- Release 2: integrate online payment (COD, bank QR, MoMo or VNPay).
- Owner can manage products and orders without a developer.
- AI helps both shoppers (assistant, search) and the owner (descriptions, translation).

## 2. Features

### MVP (release 1)
| ID | Feature | Key acceptance points |
|---|---|---|
| F01 | Product catalog | Categories (Đồng hồ, Giày), list with filter (brand, price, size, color) and sort, pagination |
| F02 | Product detail | Gallery with zoom, price in VND, variants (size/color), stock status, spec table, size guide |
| F03 | Search | Keyword search with Vietnamese diacritics tolerance (e.g. "giay" finds "giày") |
| F04 | Cart | Add, update, remove; persists across reload; guest cart merges after login |
| F05 | Order request (no payment) | Guest or account; name, phone, VN address (tỉnh/quận/phường), note, preferred contact (phone or Zalo); order summary; no payment step; shipping fee shown as "to be confirmed"; after submit, a pop-up says "Cảm ơn bạn! Lisva sẽ liên hệ sớm để xác nhận đơn hàng" with the order code and the shop hotline, and the cart is cleared |
| F07 | Orders | Order saved in the database with a short order code; no email or SMS in release 1; order history for logged-in users; statuses: Chờ liên hệ, Đã liên hệ, Đã xác nhận, Đã thanh toán (set manually), Đang giao, Hoàn thành, Đã hủy |
| F08 | Accounts | Sign up, login, profile, saved addresses (guests can still order) |
| F09 | Admin | Product CRUD with image upload, stock, order list; change status, add internal notes, record manual payment; new orders appear at the top with a "new" badge and unread count, with the customer's phone and preferred contact method shown prominently (one-tap call and Zalo link); the owner also gets an instant Telegram message for every new order (order code, customer name, phone, preferred contact, items, total, link to the admin order); the admin page remains the source of truth |
| F10 | i18n | Vietnamese default, English switcher, VND formatting, no hardcoded strings |
| F11 | SEO and performance | Metadata, sitemap, structured data (Product), image optimization, Lighthouse above 90 on mobile |

### Release 2
- F06 Online payments: COD, bank QR, MoMo or VNPay; signed webhook confirms payment and updates the order automatically (the order request flow from F05 stays as a fallback)
- F12 Reviews and ratings (verified buyers only)
- F13 Wishlist
- F14 Coupons and promotions, flash sale countdown
- F15 Email notifications (order, shipping) and Zalo/SMS optional
- F16 Admin dashboard (revenue, best sellers, low stock)
- F17 Shipping integration (GHN or GHTK)

### AI features (release 2)
- A01 Shopping assistant chatbot (answers from catalog, recommends, hands off to human)
- A02 Admin: generate Vietnamese and English product descriptions and SEO text from attributes
- A03 Auto-translate product content vi to en (owner reviews before publish)
- A04 Similar-product recommendations (embeddings)
- A05 Draft replies for customer questions

### Out of scope for now
Marketplace with multiple sellers, mobile app, loyalty points, international shipping.

## 3. Non-functional requirements
- Performance: LCP under 2.5s on 4G mobile.
- Accessibility: WCAG AA contrast, keyboard navigation, alt text.
- Security: validated inputs (Zod), hashed passwords, CSRF-safe sessions, rate limiting on login and order requests (spam protection such as a honeypot or captcha), webhook signature verification (release 2), no secrets in git.
- Privacy: only collect data needed for orders; clear privacy policy page.
- Reliability: orders are never lost; payment webhooks are idempotent.

## 4. Tech stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Frontend and backend in one project |
| UI | Tailwind CSS, shadcn/ui, lucide-react | Matches DESIGN.md, fast to build |
| i18n | Built-in Next.js pattern: `app/[lang]`, `proxy.ts`, JSON dictionaries | Documented for this Next.js version; no extra dependency |
| State | Zustand (cart) | Small, simple |
| Validation | Zod | Shared client/server schemas |
| Database | PostgreSQL (Neon or Supabase) | Reliable relational data |
| ORM | Prisma | Typed queries and migrations |
| Auth | Auth.js | Email/password plus Google login |
| Payments | None in release 1 (manual). Release 2: PayOS or VietQR, MoMo, VNPay | Common in Vietnam; pick at the F06 spec |
| Images | Cloudinary (or Supabase Storage) | Resize and CDN |
| Owner alerts | Telegram Bot API (release 1) | Free, instant push; token and chat id in env vars; a failed send must never block saving the order |
| Email | Resend (release 2) | Customer and order emails |
| AI | Claude API (Anthropic SDK) | Chatbot, descriptions, translation |
| Testing | Vitest (unit), Playwright (e2e) | Checkout flow must be tested |
| Hosting | Vercel + managed Postgres | Simple deploys |
| Monitoring | Sentry, Vercel Analytics | Errors and performance |

## 5. Spec-driven workflow
For every feature, never jump straight to code. Follow these gates and approve each one:

1. **Spec** (`docs/specs/<id>-<name>/spec.md`): what and why, user stories, acceptance criteria, edge cases. No tech details.
2. **Plan** (`plan.md`): data model, routes/API, components, files to touch, risks.
3. **Tasks** (`tasks.md`): small ordered checklist, each task testable.
4. **Implement**: one task at a time, tests first when logic is involved.
5. **Verify**: run lint, types, tests, then open it in the browser at 390px and 1280px.
6. **Review**: code review and security review, then commit.

Optional: GitHub Spec Kit can automate gates 1-3 (not yet verified for this project). Otherwise we use the plain markdown files above.

### Project files to create first
- `CLAUDE.md`: stack, commands, conventions, "read the spec before coding".
- `docs/constitution.md`: non-negotiables (TypeScript strict, no hardcoded strings, Zod on every input, mobile first, DESIGN.md rules).
- `docs/specs/`: one folder per feature.

## 6. Build phases
| Phase | Output | Specs |
|---|---|---|
| 0 Foundation (done) | Next.js app, Tailwind theme from DESIGN.md, i18n, lint/test setup (CI still to add) | none (setup) |
| 1 Data (done) | Prisma schema, migrations, seed data, order and catalog logic with tests ([spec](specs/001-database/spec.md)) | F01 model |
| 2 Storefront UI | Home, list, detail from mock data using the A1 design | F01, F02, F03 |
| 3 Cart and order request | Cart, order request form, order creation, owner notification | F04, F05 |
| 4 Accounts | Auth, profile, addresses, order history | F08, F07 |
| 5 Admin | Product and order management, manual status workflow, Telegram new-order alert | F09 |
| 6 Polish and launch (release 1) | SEO, performance, security review, deploy, domain | F10, F11 |
| 7 Online payments (release 2) | COD, QR/MoMo/VNPay, webhooks, auto status updates | F06 |
| 8 Other release 2 features | Reviews, wishlist, coupons, dashboard, shipping | F12-F17 |
| 9 AI | Assistant, descriptions, translation, recommendations | A01-A05 |

## 6b. Feature specs
- [001-database](specs/001-database/spec.md): data model for catalog, variants (optional color and size), orders. Plan in the same folder.

## 7. Skills to use
| Skill | When |
|---|---|
| `init` | Phase 0: generate CLAUDE.md |
| `ui-generator` (custom, to create) | Phase 2+: build screens from DESIGN.md |
| Taste Skill (optional, third-party) | Polish visual quality; install only after review |
| `run` | Open the app and check changes in the real browser |
| `simplify` | After each feature: remove duplication |
| `code-review` | Before every commit or PR |
| `security-review` | Before launch, and after payments/auth work |
| `claude-api` | Phase 9: Claude API integration, prompt caching, model choice |
| `update-config` | Add permissions or hooks (e.g. run lint after edits) |
| `fewer-permission-prompts` | After a few sessions, reduce approval prompts |

## 8. Agents to use
Built in:
- **Plan**: design the plan for each feature (gate 2).
- **Explore**: find code across the project without filling the main context.
- **general-purpose**: research (e.g. compare VNPay vs PayOS docs) and multi-step tasks.

Custom agents to define in `.claude/agents/` (each with a narrow job and tool limits):
| Agent | Job |
|---|---|
| `spec-writer` | Turns an idea into spec.md with acceptance criteria; asks questions, writes no code |
| `db-architect` | Prisma schema, migrations, seed data |
| `frontend-builder` | UI from DESIGN.md, a11y, i18n keys in both languages |
| `backend-builder` | Route handlers, server actions, Zod schemas, payment webhooks |
| `qa-tester` | Writes Vitest/Playwright tests and runs the checkout flow |
| `i18n-reviewer` | Checks every string exists in vi and en, VND/date formats |

Rule: one feature at a time. Independent work (e.g. db-architect and frontend-builder on different features) can run in parallel.

## 9. Decisions still open
- Payment provider for release 2 (decide later; suggest PayOS, VNPay or MoMo).
- Telegram bot: you need to create it with BotFather and send it a message to get your chat id (I will explain when we build F09). Email, Zalo and customer confirmation emails are deferred to release 2 (F15).
- Shop hotline and Zalo link in the confirmation pop-up: use placeholders for now (hotline `0900 000 000`, Zalo `https://zalo.me/0900000000`), kept in one config file (`lib/site-config.ts`) so they are replaced in one place before launch.
- Shipping: manual quote in release 1, GHN/GHTK integration in release 2.
- Where product photos come from and who shoots them.
- Domain name and hosting budget.
- Do you need VAT invoices?

## 10. Definition of done (every feature)
- Acceptance criteria in spec.md all pass.
- Lint, type check and tests pass.
- Checked in browser at 390px and 1280px, in vi and en.
- Code review done, no secrets committed.
