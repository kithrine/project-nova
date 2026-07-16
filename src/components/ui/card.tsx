import type { ComponentPropsWithoutRef } from "react";

type CardVariant = "surface" | "emphasis" | "muted";

const variantClasses: Record<CardVariant, string> = {
  /* True-white card floating on the cream base (brand pass 2026-07-16). */
  surface: "rounded-lg border border-base-300/70 bg-surface p-5 shadow-(--shadow-sm)",
  /* The established teal emphasis idiom (proposed placements, highlights). */
  emphasis: "rounded-lg border border-primary/30 bg-primary/5 p-5",
  /* The established empty-state / quiet panel idiom. */
  muted: "rounded-md border border-base-300 bg-base-200/50 px-4 py-3",
};

/** Compose card classes for non-<div> call sites (Link-wrapped cards). */
export function cardClasses(variant: CardVariant = "surface"): string {
  return variantClasses[variant];
}

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /** Explicit variant — no ad hoc styling props (docs/ux/component-guidelines.md). */
  variant?: CardVariant;
}

/**
 * Card primitive (brand pass 2026-07-16): the three container idioms the
 * app already uses everywhere, centralized. Purely presentational — no
 * business rules, no implicit headings.
 */
export function Card({ variant = "surface", className, ...props }: CardProps) {
  const classes = [variantClasses[variant], className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
