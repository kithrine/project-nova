# Component Guidelines

## Foundation

- Button
- Link
- Form Field
- Input
- Text Area
- Select
- Radio Group
- Checkbox
- Date/Time Input
- File Upload
- Badge — implemented (`src/components/ui/badge.tsx`): tones accent/success/warning/error/info/neutral, **caller-assigned** (status→tone mapping is business semantics and lives with the status vocabulary, never inside the component; rollout across the status rails is a queued follow-up)
- Card — implemented (`src/components/ui/card.tsx`): `surface` (white on cream), `emphasis` (teal tint), `muted` (empty states)
- Stat Card — implemented (`src/components/ui/stat-card.tsx`): dashboard KPI tile with filled tone icon circle; values always come from data the page already holds
- Page Header — implemented (`src/components/ui/page-header.tsx`): h1 + description + decorative slot; the role chip lives once in the shell
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

- Nova Logo (compass star — `src/components/layout/nova-logo.tsx`; the brand name is always adjacent text)
- Script Accent (Caveat word with drawn flourish — decorative styling over plain text)
- Decorative Motifs (blob, dot cluster, leaf sprig — always `aria-hidden`, never containing focusables)
- Illustrative Dashboard Card (fictional, terminology-correct data; `aria-hidden`; nothing interactive inside)
- Trust Strip (category marks, never fictional organizations)
- Value Prop Card
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
- Activity-table header recipe (documented for the rails pass, not yet applied): `thead` rows `bg-primary text-primary-content` with semibold cells
