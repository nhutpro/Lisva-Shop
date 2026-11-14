# Lisva Constitution

Rules that every feature and every change must follow.

1. **Spec first.** No feature code without an approved `spec.md` and `plan.md` in `docs/specs/<id>-<name>/`. Changing behavior means changing the spec first.
2. **Small steps.** Work through `tasks.md` one task at a time. Each task leaves the app building and tests passing.
3. **TypeScript strict.** No `any` without a comment explaining why.
4. **Validate at the edge.** Every form, route handler, server action and webhook parses input with Zod before using it.
5. **No hardcoded text.** UI strings live in `vi.json` and `en.json` with the same keys. Vietnamese is the default.
6. **Vietnam formats.** VND via `formatVnd()`, dates as dd/MM/yyyy via `formatDate()`, VN address structure (tỉnh/thành, quận/huyện, phường/xã).
7. **Design system only.** Use the tokens and rules in `docs/DESIGN.md` and `src/app/globals.css`. Mobile first; check 390px and 1280px.
8. **Accessible.** Semantic HTML, alt text, visible focus, keyboard support, AA contrast, `prefers-reduced-motion` respected.
9. **Never lose an order.** Saving the order comes first. Notifications (Telegram, email) run after and their failure must not fail the order.
10. **Secrets stay secret.** Only in environment variables, never in git, logs or client code.
11. **Test what matters.** Pricing, order creation, status changes and (release 2) payment webhooks have automated tests.
12. **Done means verified.** Lint, typecheck, tests and build pass, the page is checked in the browser in both languages, and the change has been reviewed.
