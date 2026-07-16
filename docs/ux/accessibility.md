# Accessibility

## Standard

Target WCAG 2.2 AA where practical.

## Requirements

- Keyboard navigation
- Visible focus
- Semantic headings
- Labels above inputs
- Programmatic error associations
- Text and icon status indicators
- AA contrast
- Logical tab order
- Reduced motion support
- Screen-reader transition announcements
- No drag-and-drop-only actions
- Plain language
- Responsive zoom and reflow

## Testing

- Automated accessibility checks
- Keyboard-only review
- Screen-reader spot checks
- Contrast review
- Form-error review

The Story 7.7 hardening pass is recorded in
`accessibility-review-2026-07.md`: axe scans gate CI on the public
surface (`tests/e2e/a11y.spec.ts`) and sweep every signed-in experience
in the pre-ship local suite (`tests/e2e/a11y-authenticated.spec.ts`);
muted text uses `text-base-content/60` or stronger.

Color-token changes are additionally gated by
`scripts/check-contrast.mjs` (brand refresh, 2026-07-15), which
recomputes every palette pairing — including 60%- and 70%-alpha muted
text composited over both cream surfaces — against WCAG AA and exits
nonzero if any pairing drops below minimum.
