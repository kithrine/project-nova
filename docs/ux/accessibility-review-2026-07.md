# Accessibility Hardening Review — Story 7.7 (2026-07-14)

> **Addendum (2026-07-15):** the brand refresh replaced the entire color
> palette after this review (warm cream surfaces, spruce ink, teal
> primary, chartreuse accent). Both axe suites were re-run green on the
> new palette in the same change set, and the `text-base-content/60`
> muted floor below still holds — now guarded permanently by
> `scripts/check-contrast.mjs`. The findings and fixes recorded here
> describe the pre-refresh palette and remain a historical record.

The recorded pass over `docs/ux/accessibility.md`'s checklist, covering
all four experiences (public, participant, shelter, operations). WCAG
2.2 AA target.

## Automated checks (repeatable; part of the test suites)

| Check | Where | Result |
| --- | --- | --- |
| axe WCAG A/AA scan, public pages + 360px viewport | `tests/e2e/a11y.spec.ts` — **CI merge gate** (preview job) | Pass |
| axe WCAG A/AA scan, ~21 signed-in screens across all four experiences (incl. the placement workspace via click-through) | `tests/e2e/a11y-authenticated.spec.ts` — full local suite, run before every ship | Pass after fixes below |
| Keyboard: skip link first in tab order, lands on `#main-content`, visible focus outline on next focusable | `a11y-authenticated.spec.ts` | Pass |
| Reduced motion: `prefers-reduced-motion` suppresses transitions app-wide | `globals.css` + emulated verification in `a11y-authenticated.spec.ts` | Pass (added this story) |
| Zoom/reflow: no horizontal scroll at 360px | `tests/e2e/smoke.spec.ts` + 360px axe scans | Pass |
| Roles, accessible names, `aria-sort`, `aria-current`, `sr-only` annotations on interactive components | Component suites (RTL role/name queries throughout Epics 2–7) | Pass |

## Findings and fixes (this story)

1. **Color contrast (serious)** — `text-base-content/50` (50%-opacity
   text) fails the 4.5:1 AA ratio on the `nova` theme. Found by axe on
   My Hours; the same class carried text in five more places (lifecycle
   timeline upcoming stages, incident follow-up bylines, case-note
   revision bylines, application status rail, a disabled action). All
   six bumped to `/60`, the app's standard muted-text level, which
   passes. Decorative `aria-hidden` SVG icons at `/50` are exempt and
   unchanged.
2. **Reduced motion had no support** — no `prefers-reduced-motion`
   rule existed. Added the app-wide suppression block to `globals.css`;
   nothing in Nova conveys meaning through motion alone.

## Manual review notes

- **Keyboard-only walkthrough**: sign-in → dashboard → reports →
  filters → export confirmation all reachable and operable by keyboard;
  tab order follows the DOM, which follows the visual order; no traps
  found. Forms submit on Enter; `<details>` disclosures toggle with
  Enter/Space.
- **Status indicators**: every lifecycle/status render pairs an SVG
  icon with text (house rule since Epic 2); no color-only status found
  in the sweep.
- **Form errors**: validation messages render adjacent to their
  controls with explicit text (never color alone); native `required`
  plus server-side messages. Programmatic association via
  `aria-describedby` is present on the flows built with error summaries.
- **Screen readers**: structural equivalents are verified automatically
  (roles, names, landmarks, `aria-current="step"` on rails,
  `aria-sort` on report tables, `sr-only` stage annotations). A live
  NVDA/VoiceOver spot check with real users is recommended before
  launch — recorded on the launch checklist under the accessibility
  gate; it refines copy, not structure.
- **No drag-and-drop-only actions** exist anywhere in the app.

## Standing rule

New screens must keep both axe suites green (the CI gate for public
surfaces; the authenticated sweep in the pre-ship local suite) and use
`text-base-content/60` as the minimum muted-text opacity.
