# Lisva Design System: Soft Luxe

Reference mockup: [a1-soft-luxe.html](a1-soft-luxe.html). Products: watches and shoes. Market: Vietnam (Vietnamese first, English switcher).

## Colors
| Token | Value | Use |
|---|---|---|
| bg | #F6F4EF | page background |
| surface | #FFFFFF | cards, tabs |
| ink | #16140F | text, primary dark buttons |
| mute | #7A756B | secondary text |
| gold | #B08D57 | accent |
| gold-light | #D9BC84 | gradient start, highlights on dark |
| line | #E7E3DA | borders |
| dark | #14120E | hero, footer |
| sale | #C8102E | sale badge, favorite active |

Primary CTA: gradient `135deg, gold-light -> gold`, text `#1a1408`.

## Typography (both support Vietnamese diacritics)
- Headings: Playfair Display, weight 500, tight line-height (1.05).
- Body and UI: Be Vietnam Pro, 400/500/600.
- Prices: `font-variant-numeric: tabular-nums`, weight 600.

## Radius
- sm 12px, md 20px, lg 32px, pill 999px.
- Buttons, tabs, badges, and header: pill.
- Cards: md, with the inner image area at md minus 6px.
- Hero and category tiles: lg.

## Shadows
- Default: `0 1px 2px rgba(20,18,14,.04), 0 12px 32px -12px rgba(20,18,14,.18)`
- Large (hover, hero): `0 30px 60px -20px rgba(20,18,14,.35)`

## Motion
- Easing: `cubic-bezier(.22, 1, .36, 1)`. Durations: 300-500ms for UI, 700-900ms for reveals.
- Scroll reveal: fade and rise 34px, staggered 80-120ms.
- Product cards: lift 8px on hover, image scales 1.14 and rotates -4deg, a quick-add button slides up.
- Buttons: light sweep on hover, arrow nudges right.
- Hero: floating watch, mouse tilt, shimmering headline, pulsing glow.
- Header: floating frosted-glass pill, firmer on scroll.
- Must respect `prefers-reduced-motion` (disable animations).

## Layout
- Content max width 1360px, side padding 5vw (at least 16px on mobile).
- Product grid: 4 columns on desktop, 2 on mobile.
- Mobile first. Check at 390px and 1280px.

## Components
Header pill, hero, marquee, category tiles (Đồng hồ, Giày), product card, tabs, trust row (genuine, warranty 24 months, returns 7 days, COD/QR/MoMo/VNPay), footer.

## Vietnam rules
- Currency: `Intl.NumberFormat('vi-VN')` plus ` ₫`, no decimals.
- Date: dd/MM/yyyy.
- Address: tỉnh/thành, quận/huyện, phường/xã.
- Payments: COD, bank QR, MoMo, VNPay.
- All text in message files (vi default, en secondary). No hardcoded strings.

## Don't
- No emoji as icons in the real build (the mockup uses a few as placeholders). Use lucide icons.
- No more than one accent color and two fonts.
- No placeholder drawings in production. Use consistent product photos on a plain background, with several angles.
