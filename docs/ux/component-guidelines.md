# Component Guidelines

## Foundation

- Button — implemented (`src/components/ui/button.tsx`): explicit variants, semantic `<button>`, `buttonClassName()` shares the vocabulary with Link CTAs. Hover micro-interaction (styling round 3): a `motion-safe` lift (`-translate-y-0.5` + `shadow-md`) that settles on `:active`; reduced-motion users keep the color-only hover. Button-styled public CTAs carry the same cluster, and the two arrow CTAs nudge their arrow right via `group-hover`
- Link
- Form Field
- Input
- Text Area
- Select
- Radio Group
- Checkbox
- Date/Time Input
- File Upload
- Badge — implemented (`src/components/ui/badge.tsx`): tones accent/success/warning/error/info/neutral, **caller-assigned** (status→tone mapping is business semantics and lives with the status vocabulary, never inside the component). Rolled out across the status rails (brand follow-ups 2026-07-17): each `*_STATUS_LABELS` constant now has a sibling `*_STATUS_TONES` map, and service views carry `statusTone` alongside `statusLabel` so client components never import server modules. Uniform tone vocabulary: draft/closed-neutral states → `neutral`; submitted/under-review/proposed/in-flight → `info` (the deep-denim tone's first real use); approved/active/complete/ready → `success`; needs-attention (paused, blocked, change requested, needs correction, open incident) → `warning`; adverse endings (terminated, disqualified, serious/emergency severity) → `error`. Participant-facing application tones deliberately stay neutral on closed outcomes (trauma-informed voice, `docs/ux/content-style-guide.md`). Badges appear on queue/rail/list statuses only — never spliced into prose lines like "Status: X" (they split the text for assistive tech and for E2E anchors)
- Card — implemented (`src/components/ui/card.tsx`): `surface` (white on cream), `emphasis` (teal tint), `muted` (empty states)
- Stat Card — implemented (`src/components/ui/stat-card.tsx`): dashboard KPI tile with filled tone icon circle; values always come from data the page already holds
- Page Header — implemented (`src/components/ui/page-header.tsx`): h1 + description + decorative slot; the role chip lives once in the shell. Adopted on every top-level signed-in page (brand follow-ups 2026-07-17) with h1 text kept byte-identical — E2E specs pin those strings
- Date Square — implemented (`src/components/ui/date-square.tsx`): teal month-over-day tile from the dashboard mockup. Services supply structured `DateParts` (month/day/year/full) next to the formatted label — the tile never re-derives dates client-side. The glyphs are `aria-hidden`; the full date is exposed once via `role="img"` + `aria-label`. First use: the applications queue's Submitted column
- Alert
- Toast
- Modal
- Drawer
- Tabs
- Breadcrumbs
- Skeleton
- Empty State

## Workflow

- Journey Timeline
- Lifecycle Timeline
- Progress Summary
- Task List
- Blocker List
- Status Transition Control
- Confirmation Panel

## Domain

- Application Step Card
- Eligibility Checklist
- Interview Appointment
- Application Decision
- Match Compatibility Panel
- Proposed Placement Card
- Placement Workspace Header
- Weekly Hours Card
- Timesheet Review
- Evaluation Form
- Incident Form
- Case Note Composer
- Funding Assignment Card

## Public marketing (brand refresh 2026-07-15)

- Nova Logo — the official raster mark (`public/images/logo-official.png`) at brand lockups (header, footer, shell sidebar/topbar), favicon derived from it; the hand-drawn compass-star SVG (`src/components/layout/nova-logo.tsx`) stays for eyebrow chips. The brand name is always adjacent text
- Photographic Hero (How It Works, styling round 2) — full-bleed image under a left-weighted scrim; hero copy flips to cream with a chartreuse italic accent (dark-surface use); text unchanged so all pins hold
- Script Accent (Caveat word with drawn flourish — decorative styling over plain text)
- Decorative Motifs (blob, photographic leaf line-art, breathing dot field — always `aria-hidden`, never containing focusables). Leaf imagery (round 4): `teal-leaves.png` (value section, bottom-right) and `white-leaves-navbar.png` (signed-in sidebar, bottom-left, behind the quote card) replaced the hand-drawn LeafSprig components. The breathing dot field (`src/components/decor/breathing-dots.tsx`) is the corner-anchored ambient motif (visual pass 2026-07-18): masked dot grids densest at the anchor corner, counter-phased opacity/scale breathing, `pointer-events: none`, reduced-motion shows the static field. The static dot-cluster rectangles are retired.
- Photographic Hero Image (2026-07-18: `public/images/nova-homepage-hero.png`, rounded 1rem with the card shadow, decorative — empty alt + `aria-hidden` wrapper). The Illustrative Dashboard Card (fictional, terminology-correct data; `aria-hidden`; nothing interactive inside) it replaced is commented out in `page.tsx` for potential return
- Trust Strip (category marks, never fictional organizations)
- Value Prop Card — Lucide-derived icon quartet (styling round 4: hand-heart, paw-print, workflow, chart-line as inlined local components) with one palette voice per card (bright teal / chartreuse / dark teal / golden yellow): the icon ink plus a super-low-opacity wash of the same color across the card background and icon circle, via CSS-var tone classes on the card (`.valueCard*`). Chartreuse ink deepens to olive on light surfaces. Explicit classes, never structural selectors. The section's bottom-right carries `teal-leaves.png` line-art behind the cards
- Directional Reveal (`src/app/(public)/how-it-works/reveal.tsx`, styling round 3): `from="up" | "left" | "right"` — journey steps weave from alternating sides, the expectations pair and homepage value cards converge; horizontal reveals re-hide toward their own side (exit-edge logic is vertical-only)
- Closing Band (teal; carries no interactive elements — the global focus ring is teal and would vanish)

## Engineering rules

- Accessible by keyboard
- Semantic HTML
- Explicit variants
- No excessive boolean props
- No business rules inside components
- Tailwind, DaisyUI, and native CSS are all approved
- Never use emojis as icons or status indicators. Use SVGs — from an approved icon set, or purpose-built SVGs — with an accessible label for meaningful icons and hidden from assistive technology when purely decorative
- Build every component mobile-first, then progressively enhance for larger viewports
- The chartreuse accent is decorative or dark-text-on-accent only — never a text color on light surfaces (`docs/ux/visual-design-reference.md`)
- Decorative wrappers (`aria-hidden`) must never contain focusable elements
- On teal (`primary`) surfaces the focus ring is `accent`, never `primary` — the global ring is invisible there
- Activity-table header recipe (applied 2026-07-17): `thead` `bg-primary text-primary-content` with semibold cells — live on the applications queue, funding sources, audit review, hours by funding, and active placement summary tables. Interactive elements inside a teal `thead` (e.g. the summary's sort links) take `focus-visible:outline-accent` and keep `aria-sort`
