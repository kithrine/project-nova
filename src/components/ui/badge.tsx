import type { ReactNode } from "react";

export type BadgeTone = "accent" | "success" | "warning" | "error" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  /* Chartreuse-tinted chip with teal text (role chips, eyebrows) —
     the primary-on-accent-18% pairing is asserted in check-contrast.mjs. */
  accent: "border-primary/25 bg-accent/20 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-error/30 bg-error/10 text-error",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-base-300 bg-base-200 text-base-content/70",
};

/**
 * Badge primitive (brand pass 2026-07-16). Tones are CALLER-assigned —
 * mapping a domain status to a tone is business semantics and lives with
 * the status vocabulary, never inside this component
 * (docs/ux/component-guidelines.md). Text carries the meaning; the tone
 * only reinforces it (never color alone).
 */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
