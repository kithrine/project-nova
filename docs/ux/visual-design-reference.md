# Visual Design Reference

## Emotional goals

- Hope
- Trust
- Calm
- Progress
- Professional warmth

## Visual principles

- Neutral-first interface
- Deep blue primary
- Muted teal accent
- Calm green success
- Amber warning
- Muted red danger
- Strong whitespace
- Minimal shadows
- Moderate radii
- Clear hierarchy

## Typography

Use a highly readable sans-serif such as Inter.

## Iconography

Never use emojis in the interface. Use SVG icons — from an approved icon set or purpose-built, hand-authored SVGs — so every icon is crisp at any size, themeable through design tokens, and accessible. Give meaningful icons an accessible label; mark decorative icons as hidden from assistive technology. Never convey status by color or icon alone; always pair it with text.

## Signature component

The Journey Timeline is Project Nova’s defining visual motif.

## Motion

Motion communicates state. Use subtle transitions in the application and more expressive effects only on public pages.

## Dark mode

Design tokens should permit it later, but dark mode is not MVP.

## Token implementation

Tokens are implemented as CSS variables (Story 1.1). Color tokens live in the DaisyUI `nova` theme in `src/app/globals.css` (deep blue primary `#1d4ed8`, muted teal accent `#0f766e`, calm green success `#15803d`, amber warning `#b45309`, muted red danger `#b91c1c`, neutral slate surfaces). Non-color tokens (radii, shadows, focus ring, motion durations with reduced-motion support) live in `src/styles/tokens.css`. The typeface is Inter via `next/font`.
