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

Motion communicates state. Use subtle transitions in the application and more expressive effects only on public pages. Everything animated is gated behind `prefers-reduced-motion`. The How It Works pawprint trail loops continuously (public-pages expressive motion) — opacity-only keyframes inside the `no-preference` block, with a static faded trail as the reduced-motion state.

## Dark mode

Design tokens should permit it later, but dark mode is not MVP.

## Token implementation

Tokens are implemented as CSS variables (Story 1.1; brand refresh 2026-07-15). Color tokens live in the DaisyUI `nova` theme in `src/app/globals.css`:

- Warm cream surfaces: `#faf6ec` / `#f4efe2` / `#e3dcca`
- Near-black spruce ink `#0b1712` — deliberately this dark so `text-base-content/60` (the app's muted-text floor) stays ≥ 4.5:1 on both cream surfaces
- Deep teal primary `#0f6b5c`; supporting teal secondary `#0f766e`
- Electric chartreuse accent `#d9e021` with dark content `#1f2a05` (≥ 7:1) — decorative or dark-text-on-accent only
- Calm green success `#0f6a32` and amber warning `#9a4507` (re-deepened 2026-07-17: Badge chips tint their background with the tone at 10%, and the tone-as-text must clear 4.5:1 on that composite — the contrast gate now asserts it)
- Muted red danger `#b91c1c`; deep denim info `#1e5a8a` (retinted from royal blue in the 2026-07-16 brand pass — reserved for informational statuses, currently unused)
- True-white surface `#ffffff` (`--color-surface`, brand pass 2026-07-16) — the signed-in app's card color, floating on the cream base

Non-color tokens (radii, shadows, focus ring, motion durations with reduced-motion support) live in `src/styles/tokens.css`.

## Signed-in shell (brand pass 2026-07-16)

- Full-height deep-teal (`primary`) sidebar from `md` up; cream (`base-100`) text; the compass-star brand mark in cream.
- Active nav item: chartreuse→cream gradient pill with dark `accent-content` text and `aria-current="page"`.
- **On teal surfaces the focus ring is `accent`, never `primary`** (the global primary ring is invisible there — same rule as the public closing bands).
- Muted text on teal uses `base-100/85` or stronger (`/70` fails AA — computed); disabled nav items are `base-100/60`, `aria-disabled` (axe-exempt), held to a self-imposed ≥ 3:1.
- The sidebar carries no interactive elements outside the nav (the bottom quote card is static).
- Dashboards: white `surface` stat cards with filled tone icon circles; the role chip renders once, in the topbar.

## Status color and data tables (brand follow-ups 2026-07-17)

- Statuses on queues, rails, and lists render as Badge chips with tones from the `*_STATUS_TONES` maps beside each status vocabulary — uniform semantics: neutral for drafts and closed-without-fault states, `info` (deep denim — its first live use) for in-flight, `success` for good states, `warning` for needs-attention, `error` for adverse endings. Prose lines ("Status: X") stay plain text.
- Data tables wear the teal header band: `thead` `bg-primary text-primary-content`, semibold cells; any control inside the band uses the accent focus ring.
- Date squares (teal month-over-day tiles) mark submission dates in the applications queue; assistive tech hears the full date once.

**Standing rule:** any change to the color tokens must re-run `node scripts/check-contrast.mjs`, which recomputes every palette pairing the app relies on (including alpha-composited muted text) against WCAG AA and fails the change if anything drops below minimum.
