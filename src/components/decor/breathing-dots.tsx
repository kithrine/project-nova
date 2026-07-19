import styles from "./breathing-dots.module.css";

/**
 * Breathing teal dot field (visual pass 2026-07-18) — decorative only
 * (aria-hidden, pointer-events none). Densest at the anchor corner and
 * fading across the page; two counter-phased opacity/scale loops make it
 * "breathe" (docs/ux/visual-design-reference.md). The caller positions
 * and sizes the host — it MUST be positioned, because the dot layers are
 * absolutely-inset pseudo-elements.
 */
const ANCHOR_CLASS = {
  "top-right": styles.topRight,
  "bottom-right": styles.bottomRight,
  "left-center": styles.leftCenter,
} as const;

export function BreathingDots({
  anchor,
  className,
}: {
  anchor: keyof typeof ANCHOR_CLASS;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.dots} ${ANCHOR_CLASS[anchor]}${className ? ` ${className}` : ""}`}
    />
  );
}
