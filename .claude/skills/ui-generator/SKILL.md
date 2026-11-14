---
name: ui-generator
description: Generate Lisva Shop storefront and admin UI (pages, sections, components) from docs/DESIGN.md using Next.js, Tailwind and shadcn/ui, Vietnamese first with an English dictionary. Use when asked to design or build any screen, e.g. home, product list, product detail, cart, order request, account, admin.
---

# Lisva UI Generator

## Before building
1. Read `docs/DESIGN.md` (tokens, radius, motion) and look at `docs/a1-soft-luxe.html` for the intended look and feel.
2. Read the feature's `spec.md` in `docs/specs/` if one exists. If not, ask for a spec first.
3. Read the Next.js docs in `node_modules/next/dist/docs/` for any API you are unsure about (this version differs from older ones).

## Stack rules
- Next.js App Router under `src/app/[lang]/`. Server Components by default; `"use client"` only for interactivity (cart, forms, menus, dialogs).
- Reusable pieces in `src/components/` (`ui/` for shadcn primitives, `shop/` for product, cart, order). Add shadcn components with `npx shadcn@latest add <name>`.
- Use the Tailwind tokens from `src/app/globals.css` (`bg-background`, `text-muted-foreground`, `bg-gold`, `rounded-md`, `rounded-full`, `shadow-soft`, `ease-soft`). Do not invent colors, radii or fonts.
- Headings use the heading font (`font-heading`), everything else the sans font.
- Icons from lucide-react. No emoji as icons.
- Images with `next/image`, fixed aspect ratios, descriptive alt text.

## Language and formats
- Never hardcode visible text. Add keys to both `src/i18n/dictionaries/vi.json` and `en.json`.
- Get text with `getDictionary()` in Server Components; pass the needed strings to Client Components as props.
- Prices with `formatVnd()`, dates with `formatDate()`. Contact details from `siteConfig`.
- Order request (release 1) has no payment step. After submit, show a pop-up with the order code and hotline.

## Quality bar
- Mobile first. Check at 390px and 1280px.
- Include loading, empty and error states.
- Hover and scroll effects follow DESIGN.md (soft easing, 300-900ms) and are disabled under `prefers-reduced-motion`.
- Touch targets at least 44px. Visible focus. Semantic elements.

## Finish
1. Run `npm run lint`, `npm run typecheck`, `npm test`.
2. Run the app and check the screen in both languages.
3. Summarize what was built, what is still mocked, and which dictionary keys were added.

## Don't
- Don't add backend logic, auth or payments in UI work; those belong to their own specs.
- Don't add UI libraries beyond the stack without asking.
