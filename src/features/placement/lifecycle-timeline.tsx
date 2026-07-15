import type { TimelineStage } from "@/server/domain/placement";

/**
 * Lifecycle Timeline (Story 5.1; docs/ux/component-guidelines.md): every
 * documented stage with the current one indicated by text and icon —
 * never color alone. Terminal stages close the line; nothing after them
 * reads as upcoming except the never-reached remainder of the main path,
 * which stays visibly muted and un-actionable.
 */

function StageIcon({ state }: { state: TimelineStage["state"] }) {
  if (state === "past") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 shrink-0 text-success"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    );
  }
  if (state === "current") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-4 shrink-0 text-primary"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4 shrink-0 text-base-content/30"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function LifecycleTimeline({ stages }: { stages: TimelineStage[] }) {
  return (
    <ol
      aria-label="Placement lifecycle"
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      {stages.map((stage) => (
        <li
          key={stage.status}
          aria-current={stage.state === "current" ? "step" : undefined}
          className={`flex items-center gap-1.5 text-sm ${
            stage.state === "current"
              ? "font-semibold"
              : stage.state === "upcoming"
                ? "text-base-content/60"
                : "text-base-content/80"
          }`}
        >
          <StageIcon state={stage.state} />
          {stage.label}
          {stage.state === "current" ? (
            <span className="sr-only">(current stage)</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
