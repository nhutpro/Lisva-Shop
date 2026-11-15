---
name: senior-frontend
description: >
  Frontend engineering guide for Lisva Shop (Next.js 16 App Router, React 19, Tailwind 4 tokens, shadcn/ui
  on Base UI, built-in vi/en dictionaries, Zustand cart): component architecture, state, accessibility,
  performance, testing. Use when building or reviewing storefront or admin UI, adding components or
  hooks, or checking bundle and page performance.
license: MIT + Commons Clause
metadata:
  version: 1.2.0-lisva
  author: borghei (original), adapted for Lisva Shop
  category: engineering
  domain: frontend
  updated: 2026-11-15
  tags: [react, nextjs, tailwind, accessibility, performance, i18n]
---
# Senior Frontend (Lisva edition)

Adapted from a generic React/Next.js skill to this project. **Project rules win over anything in this skill:** `CLAUDE.md`, `docs/DESIGN.md`, `docs/constitution.md`, the feature's `spec.md`, and the `ui-generator` skill (which owns the look, tokens and copy rules). The `frontend-builder` agent follows this skill.

## Project facts

| Topic | This project |
|---|---|
| Framework | Next.js 16.4, React 19.3, TypeScript strict. `cacheComponents` on. Read `node_modules/next/dist/docs/` before using an API. |
| Routes | `src/app/[lang]/...` (root layout inside `[lang]`), locale redirect in `src/proxy.ts`. |
| Components | `src/components/ui/` (shadcn on Base UI, pill buttons), `src/components/shop/` for shop pieces. |
| Styling | Tailwind 4 tokens in `src/app/globals.css` (colors, radius 12/20/32/pill, shadows, easing). Look and motion: `docs/DESIGN.md`, mockup `docs/a1-soft-luxe.html`. `cn` from `@/lib/utils`, variants with `cva`. |
| i18n | Built-in, no library: `src/i18n/dictionaries/{vi,en}.json`, `getDictionary()` in Server Components, strings passed to Client Components as props. Prices `formatVnd()`, dates `formatDate()`. |
| State | Cart only: Zustand with persist, storing `{ variantId, quantity }`. Everything else is server data or URL state. |
| Data | Domain functions in `src/lib/` (`catalog/`, `orders/`) called from Server Components and server actions. Variants are optional; use `effectivePrice` and `pickImages`. |
| Tests | Vitest 4 + Testing Library (jsdom). DB tests need `npm run db:up`. |
| Commands | `npm run dev / lint / typecheck / test / build`. Node 20.13 locally. |

## Workflow
1. **Read** the spec, `docs/DESIGN.md`, and look at existing components. Reuse before creating.
2. **Plan the split:** page (data, metadata) → section (composition) → primitives. Decide the few interactive leaves that need `"use client"`.
3. **Build leaf-first.** Add keys to both dictionaries at the same time. Mobile styles first, then `md:`/`lg:`.
4. **States:** loading skeleton, empty, error, plus disabled and pending states on actions.
5. **Accessibility per component:** semantic element, label, keyboard, visible focus, 44px target, live region for dynamic messages. Check by keyboard before moving on.
6. **Tests** with Testing Library by role: variant picker (disabled combos, price and photo change), cart, order form (validation, pending, success dialog).
7. **Verify:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; then the browser at 390px and 1280px, in `/vi` and `/en`.
8. **Performance:** `next/image` with `sizes` and `priority` on the one LCP image only; keep server libraries out of client code; targets LCP under 2.5 s on 4G mobile, no layout shift, Lighthouse mobile above 90.

## Reference docs: what applies here
Based on the section headings; read the sections you need.

| File | Use for | Skip or be careful |
|---|---|---|
| `references/react_patterns.md` | Compound components, custom hooks, composition | HOC and class error boundaries (use `error.tsx`), Context+reducer for the cart (use the Zustand rule), `React.memo`/`useMemo` unless a measured problem |
| `references/frontend_best_practices.md` | Accessibility, Testing Library, CVA variants, discriminated-union props | Playwright section until e2e is set up |
| `references/nextjs_optimization_guide.md` | Server vs Client rendering, `next/image`, dynamic imports, Suspense streaming | **Caching sections** (fetch cache options, route segment config): written for older Next.js behavior. This project uses `cacheComponents`; the bundled Next docs win |
| `references/code-patterns.md`, `references/tooling-guide.md` | Snippets; tool flags | Scaffolder, Storybook and Vite material |
| `references/bundle_rules.json` | Rules read by the bundle analyzer | n/a |

Each reference file carries a short note at the top repeating this.

## Tools: status in this project

| Tool | Status | Notes |
|---|---|---|
| `scripts/bundle_analyzer.py` | Usable, rough | Read-only static scan of `package.json` and imports (`python3 -I .claude/skills/senior-frontend/scripts/bundle_analyzer.py . --verbose`). Scores the project 100/100. It does not measure real bundle size. Its tip to add `lucide-react` to `optimizePackageImports` is unnecessary: Next's bundled docs list it as optimized by default. Its `images.remotePatterns` tip matters only once we load remote images (for example Cloudinary). |
| `scripts/component_generator.py` | Optional boilerplate | Use `--type client --with-test` into a scratch folder (`--dir`), never `--with-story`. It creates a bare `div` wrapper, an `index.ts` and a minimal test; rewrite it to our tokens, dictionary props and naming before copying in. Low value for real components. |
| `scripts/frontend_scaffolder.py` | **Not used** | The app already exists; running it creates a second project. Its `auth` feature is also not ours (Auth.js) and the Vite template does not apply. |

`assets/` holds sample projects and templates for the original tools; ignore them. Read any script before running it; write generated output outside the repo until reviewed.

## Anti-patterns
Generic (kept from the original skill):
- Whole pages marked `'use client'`. Push it down to the smallest interactive leaf.
- Reporting the static analyzer score as the bundle size. Measure a production build.
- Treating accessibility as a final pass. Build with semantic elements from the start.
- Treating a client-side guard as authentication. Real checks happen on the server.

Specific to Lisva:
- Hardcoded visible strings, colors, radii or fonts instead of dictionaries and tokens.
- Gold (`#B08D57`) as small text on the light background (about 2.8:1 contrast). Use it for large text, borders, icons and button fills with dark text.
- Copying props into state, or `useEffect` for fetching or deriving values.
- Storing prices or names in the cart.
- Placeholder drawings shipped as product images.
- Adding Storybook, an animation library, a form library or another state library without asking.
- Fixing a backend problem inside the UI.

## Scope
Covers: component architecture, state, accessibility, performance and tests for this codebase's UI.
Does not cover: visual design direction (`docs/DESIGN.md` and `ui-generator`), backend (`senior-backend`), end-to-end suites, CI/CD, penetration testing.
