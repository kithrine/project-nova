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
- Organic decoration (blobs, breathing dot fields, leaf sprigs, drawn flourishes) on public pages and as quiet ambient corners of the signed-in shell — always `aria-hidden`, never containing focusables
- Strong whitespace
- Minimal shadows
- Moderate radii
- Clear hierarchy

## Typography

- **Inter** — the app-wide body face (highly readable sans-serif), loaded in the root layout.
- **Lora** — the display serif for public pages (`--font-display`), normal + italic (swapped from Fraunces 2026-07-18 — its wonky f/j letterforms read wrong at display sizes). The How It Works accent phrase is Lora italic in secondary teal.
- **Caveat** — the pen-drawn script (`--font-script`), homepage only (the How It Works accent reverted to italic serif 2026-07-18), for single accent words and short taglines — never body copy, never in the signed-in app.

## Iconography

Never use emojis in the interface. Use SVG icons — from an approved icon set or purpose-built, hand-authored SVGs — so every icon is crisp at any size, themeable through design tokens, and accessible. Give meaningful icons an accessible label; mark decorative icons as hidden from assistive technology. Never convey status by color or icon alone; always pair it with text.

The brand mark at lockups (public header/footer, signed-in sidebar and topbar) is the official compass-star raster (`public/images/logo-official.png`, transparent PNG, rendered decorative with the brand name as adjacent text) — rolled out styling round 2, 2026-07-18. The favicon (`src/app/icon.png` + `favicon.ico`) is generated from the same mark. The hand-drawn compass-star SVG (`src/components/layout/nova-logo.tsx`) remains for eyebrow chips and small decoration; the paw remains the shelter-work decorative motif. The full lockup art (`public/images/nova-logo.png`) appears once, centered in the homepage closing band.

The homepage value cards carry a custom glyph quartet (styling round 3, 2026-07-18) — four hand-authored SVGs in the LeafSprig/DrawnHeart stroke idiom (person-with-sparkle, paw-in-heart, clipboard-with-flow, rising-bars-with-star), each inside its own tone circle: teal, chartreuse tint, deep denim info, and amber. Every icon ink is a contrast-vetted deep token; chartreuse appears only as a background tint, never an ink. Tones are explicit per-card classes (`.valueIcon*` in `home.module.css`), not structural selectors — a `:nth-child` alternation silently dies when a wrapper (like `Reveal`) makes each card an only child.

## Signature component

The Journey Timeline is Project Nova's defining visual motif.

## Motion

Motion communicates state. Use subtle transitions in the application and more expressive effects on public pages. Everything animated is gated behind `prefers-reduced-motion`. Below the How It Works hero runs the ball chase (visual pass 2026-07-18; widened full-bleed with larger chartreuse/teal paws in styling round 2, grown again to 31–36px in round 3): a red toy ball bounces in with five diminishing, squash-and-stretch bounces and a synced contact shadow, settles at the right, and paw prints trot after it in a moving window before the scene clears — one 9s master cycle, transform/opacity only, with a static resting pose (ball at rest, faded trail) as the reduced-motion state. The How It Works hero itself is a full-bleed photo under a left-weighted spruce scrim with cream text (chartreuse italic accent — dark-surface use); its copy sits in a `max-w-7xl` container (round 3) so the text hugs the left and the image's center-right focal point stays clear. The How It Works journey stepper carries a left-edge half-circle breathing dot arc; the homepage hero entrance is deliberately slow (1.1s staggered).

Buttons and button-styled CTA links carry a hover micro-interaction (styling round 3): a `motion-safe` half-pixel-rem lift with a grown shadow that settles back on `:active`; the two arrow CTAs also nudge their arrow right via `group-hover`. Reduced-motion users keep the color-only hover.

Since the visual pass (2026-07-18):

- **Scroll reveals are reversible** — the `Reveal` helper toggles on both enter and leave, so content replays in either scroll direction. Exits drift toward the edge they left through (`data-exit`), which keeps the IntersectionObserver from oscillating at the boundary; stagger delays apply to entrances only.
- **Reveals are directional** (styling round 3): `from="up" | "left" | "right"` — headings keep the classic rise; the How It Works journey steps weave in from alternating sides, the expectations pair converges (left card from left, right card from right), and the homepage value cards converge toward center. Horizontal reveals ignore the exit edge — they re-hide toward their own side, which can never oscillate the observer — and both page modules' `overflow-x: clip` keeps the hidden offsets from widening 360px viewports.
- **The breathing dot field** is the ambient motif: masked teal dot grids densest at an anchor corner (homepage top-right, signed-in shell bottom-right), fading across the page, breathing on counter-phased 9s/13s opacity/scale loops (compositor-only). Reduced motion shows the static mid-opacity field. It runs in two emphasis tiers (styling round 3): the public anchors (homepage top-right, How It Works journey arc) are deliberately louder — higher alpha, larger dots — while the dashboard bottom-right anchor stays quiet so work surfaces are never distracted.

## Dark mode

Design tokens should permit it later, but dark mode is not MVP.

## Token implementation

Tokens are implemented as CSS variables (Story 1.1; brand refresh 2026-07-15). Color tokens live in the DaisyUI `nova` theme in `src/app/globals.css`:

- Warm cream surfaces: `#faf6ec` / `#f4efe2` / `#e3dcca`
- Near-black spruce ink `#0b1712` — deliberately this dark so `text-base-content/60` (the app's muted-text floor) stays ≥ 4.5:1 on both cream surfaces
- Deep teal primary `#0f6b5c`; supporting teal secondary `#0f766e`
- Electric chartreuse accent `#d9e021` with dark content `#1f2a05` (≥ 7:1) — decorative or dark-text-on-accent only
- Calm green success `#0f6a32` and amber warning `#9a4507` (re-deepened 2026-07-17: Badge chips tint their background with the tone at 10%, and the tone-as-text must clear 4.5:1 on that composite — the contrast gate now asserts it)
- Muted red danger `#b91c1c`; deep denim info `#1e5a8a` (retinted from royal blue in the 2026-07-16 brand pass — carries in-flight status badges since the 2026-07-17 follow-ups)
- True-white surface `#ffffff` (`--color-surface`, brand pass 2026-07-16) — the signed-in app's card color, floating on the cream base

Non-color tokens (radii, shadows, focus ring, motion durations with reduced-motion support) live in `src/styles/tokens.css`.

## Signed-in shell (brand pass 2026-07-16)

- Full-height deep-teal (`primary`) sidebar from `md` up; cream (`base-100`) text; the compass-star brand mark in cream.
- Active nav item: chartreuse→cream gradient pill with dark `accent-content` text and `aria-current="page"`.
- **On teal surfaces the focus ring is `accent`, never `primary`** (the global primary ring is invisible there — same rule as the public closing bands).
- Muted text on teal uses `base-100/85` or stronger (`/70` fails AA — computed); disabled nav items are `base-100/60`, `aria-disabled` (axe-exempt), held to a self-imposed ≥ 3:1.
- The sidebar carries no interactive elements outside the nav (the bottom quote card is static).
- Dashboards: white `surface` stat cards with filled tone icon circles; the role chip renders once, in the topbar.
- A breathing dot field sits fixed in the viewport's bottom-right corner behind all content (visual pass 2026-07-18) — negative z-index, visible only through transparent cream areas; the sidebar's static dot cluster is retired.

## Status color and data tables (brand follow-ups 2026-07-17)

- Statuses on queues, rails, and lists render as Badge chips with tones from the `*_STATUS_TONES` maps beside each status vocabulary — uniform semantics: neutral for drafts and closed-without-fault states, `info` (deep denim — its first live use) for in-flight, `success` for good states, `warning` for needs-attention, `error` for adverse endings. Prose lines ("Status: X") stay plain text.
- Data tables wear the teal header band: `thead` `bg-primary text-primary-content`, semibold cells; any control inside the band uses the accent focus ring.
- Date squares (teal month-over-day tiles) mark submission dates in the applications queue; assistive tech hears the full date once.

**Standing rule:** any change to the color tokens must re-run `node scripts/check-contrast.mjs`, which recomputes every palette pairing the app relies on (including alpha-composited muted text) against WCAG AA and fails the change if anything drops below minimum.
