# Visual Design Reference

## Emotional goals

- Hope
- Trust
- Calm
- Progress
- Professional warmth

## Visual principles

- Warm cream surfaces
- Deep teal primary
- Electric chartreuse accent — decorative or dark-text-on-accent only, never a text color on light surfaces
- Calm green success
- Amber warning
- Muted red danger
- Organic decoration (blobs, dot clusters, leaf sprigs, drawn flourishes) on public pages only, always `aria-hidden`
- Strong whitespace
- Minimal shadows
- Moderate radii
- Clear hierarchy

## Typography

- **Inter** — the app-wide body face (highly readable sans-serif), loaded in the root layout.
- **Fraunces** — the display serif for public pages (`--font-display`), with its SOFT/WONK variable axes used for warm, slightly wonky accents.
- **Caveat** — the pen-drawn script (`--font-script`), public pages only, for single accent words and short taglines — never body copy, never in the signed-in app.

## Iconography

Never use emojis in the interface. Use SVG icons — from an approved icon set or purpose-built, hand-authored SVGs — so every icon is crisp at any size, themeable through design tokens, and accessible. Give meaningful icons an accessible label; mark decorative icons as hidden from assistive technology. Never convey status by color or icon alone; always pair it with text.

The brand mark is the compass star (`src/components/layout/nova-logo.tsx`); the paw remains the shelter-work decorative motif.

## Signature component

The Journey Timeline is Project Nova's defining visual motif.

## Motion

Motion communicates state. Use subtle transitions in the application and more expressive effects only on public pages. Everything animated is gated behind `prefers-reduced-motion`.

## Dark mode

Design tokens should permit it later, but dark mode is not MVP.

## Token implementation

Tokens are implemented as CSS variables (Story 1.1; brand refresh 2026-07-15). Color tokens live in the DaisyUI `nova` theme in `src/app/globals.css`:

- Warm cream surfaces: `#faf6ec` / `#f4efe2` / `#e3dcca`
- Near-black spruce ink `#0b1712` — deliberately this dark so `text-base-content/60` (the app's muted-text floor) stays ≥ 4.5:1 on both cream surfaces
- Deep teal primary `#0f6b5c`; supporting teal secondary `#0f766e`
- Electric chartreuse accent `#d9e021` with dark content `#1f2a05` (≥ 7:1) — decorative or dark-text-on-accent only
- Calm green success `#147a3a` and amber warning `#a84d08` (both deepened from their pre-refresh values to clear 4.5:1 on the tinted base-200)
- Muted red danger `#b91c1c`; info blue `#1d4ed8`

Non-color tokens (radii, shadows, focus ring, motion durations with reduced-motion support) live in `src/styles/tokens.css`.

**Standing rule:** any change to the color tokens must re-run `node scripts/check-contrast.mjs`, which recomputes every palette pairing the app relies on (including alpha-composited muted text) against WCAG AA and fails the change if anything drops below minimum.
