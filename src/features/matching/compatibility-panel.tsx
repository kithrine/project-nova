import {
  FACTOR_STATUS_LABELS,
  type CompatibilityFactor,
  type CompatibilityResult,
} from "@/server/domain/compatibility";

/**
 * Match Compatibility Panel (Story 4.2; docs/ux/component-guidelines.md;
 * ADR-011). One of exactly four categorical reads — never a numeric score —
 * with the specific factors behind it listed in plain language. Every
 * status is text + SVG icon, never color alone. Coordinator-facing only.
 */

function CategoryIcon({ category }: { category: CompatibilityResult["category"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-6 shrink-0",
  };
  switch (category) {
    case "COMPATIBLE":
      return (
        <svg {...common} className={`${common.className} text-success`}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
      );
    case "POTENTIAL_CONCERN":
      return (
        <svg {...common} className={`${common.className} text-warning`}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5h.01" />
        </svg>
      );
    case "BLOCKING_INCOMPATIBILITY":
      return (
        <svg {...common} className={`${common.className} text-error`}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
        </svg>
      );
    case "UNKNOWN_NEEDS_REVIEW":
      return (
        <svg {...common} className={`${common.className} text-base-content/60`}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.24c-.7.34-1.1.9-1.1 1.66v.35M12 16.75h.01" />
        </svg>
      );
  }
}

function FactorIcon({ status }: { status: CompatibilityFactor["status"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "mt-0.5 size-4 shrink-0",
  };
  switch (status) {
    case "CLEAR":
      return (
        <svg {...common} className={`${common.className} text-success`}>
          <path d="m5 13 4 4 10-11" />
        </svg>
      );
    case "CONCERN":
      return (
        <svg {...common} className={`${common.className} text-warning`}>
          <path d="M12 4 3 19h18L12 4z" />
          <path d="M12 10v4M12 16.5h.01" />
        </svg>
      );
    case "BLOCKING":
      return (
        <svg {...common} className={`${common.className} text-error`}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "UNKNOWN":
      return (
        <svg {...common} className={`${common.className} text-base-content/50`}>
          <path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.24c-.7.34-1.1.9-1.1 1.66v.6M12 16.5h.01" />
        </svg>
      );
  }
}

const CATEGORY_SURFACE: Record<CompatibilityResult["category"], string> = {
  COMPATIBLE: "border-success/40 bg-success/5",
  POTENTIAL_CONCERN: "border-warning/40 bg-warning/5",
  BLOCKING_INCOMPATIBILITY: "border-error/40 bg-error/5",
  UNKNOWN_NEEDS_REVIEW: "border-base-300 bg-base-200/50",
};

export function CompatibilityPanel({ result }: { result: CompatibilityResult }) {
  return (
    <section aria-labelledby="compatibility-heading" className="flex max-w-2xl flex-col gap-4">
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${CATEGORY_SURFACE[result.category]}`}
      >
        <CategoryIcon category={result.category} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
            Compatibility read
          </p>
          <h2 id="compatibility-heading" className="text-lg font-semibold">
            {result.categoryLabel}
          </h2>
        </div>
      </div>

      <ul aria-label="Compatibility factors" className="flex flex-col gap-1.5">
        {result.factors.map((factor) => (
          <li
            key={factor.key}
            className="flex items-start gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm"
          >
            <FactorIcon status={factor.status} />
            <span className="min-w-0">
              <span className="font-medium">
                {factor.label} — {FACTOR_STATUS_LABELS[factor.status]}:
              </span>{" "}
              {factor.detail}
            </span>
          </li>
        ))}
      </ul>

      <p className="max-w-prose text-xs text-base-content/60">
        Advisory only — the coordinator makes the decision, never this panel
        (ADR-011). No score exists behind this read.
      </p>
    </section>
  );
}
