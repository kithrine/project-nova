import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Explicit variant — no ad hoc styling props (docs/ux/component-guidelines.md). */
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-fast) " +
  // Hover lift + settle (styling round 3) — motion-safe only, so
  // reduced-motion users keep the color-only hover.
  "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md " +
  "motion-safe:active:translate-y-0 motion-safe:active:shadow-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-content hover:bg-primary/90",
  secondary: "border border-base-300 bg-base-100 text-base-content hover:bg-base-200",
  // Chartreuse CTA (brand pass): always dark accent-content text — the
  // accent is never a text color itself (docs/ux/visual-design-reference.md).
  accent: "bg-accent text-accent-content hover:bg-accent/85",
  danger: "bg-error text-error-content hover:bg-error/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

/**
 * Compose the button classes for non-<button> call sites (Link CTAs) so
 * anchors and buttons share one visual vocabulary.
 */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return [baseClasses, variantClasses[variant], sizeClasses[size]].join(" ");
}

/**
 * Base button primitive. Semantic <button>, keyboard-accessible, visible focus,
 * explicit variants. Defaults to type="button" so buttons inside forms never
 * submit accidentally.
 */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  const classes = [buttonClassName(variant, size), className].filter(Boolean).join(" ");

  return <button type={type} className={classes} {...props} />;
}
