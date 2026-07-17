import Link from "next/link";
import type { ReactNode } from "react";

export type StatTone = "primary" | "success" | "accent" | "warning" | "error";

const iconCircleClasses: Record<StatTone, string> = {
  primary: "bg-primary text-primary-content",
  success: "bg-success text-success-content",
  accent: "bg-accent text-accent-content",
  warning: "bg-warning text-warning-content",
  error: "bg-error text-error-content",
};

/**
 * Stat card (brand pass 2026-07-16): the dashboard KPI tile — white
 * surface, filled icon circle, label, value, optional sub-line or link.
 * Values come from data the page already holds; this component invents
 * nothing and owns no business rules. The icon is supplied by the caller
 * and must be aria-hidden (the label text carries the meaning).
 */
export function StatCard({
  label,
  value,
  sublabel,
  href,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
  icon: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-base-300/70 bg-surface p-5 shadow-(--shadow-sm)">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconCircleClasses[tone]}`}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-base-content/70">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {href && sublabel ? (
          <Link
            href={href}
            className="text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {sublabel}
          </Link>
        ) : sublabel ? (
          <p className="truncate text-sm text-base-content/60">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}
