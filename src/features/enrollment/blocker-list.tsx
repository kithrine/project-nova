import type { MatchingBlocker } from "@/server/domain/matching-readiness";

/**
 * Blocker List (Story 3.6; docs/ux/component-guidelines.md) — the
 * coordinator's answer to "what is stopping this participant from being
 * matched?". Every blocker names its requirement and links to the section
 * that resolves it. Status is text + icon, never color alone; the empty
 * state is explicit, never a blank panel.
 */

const KIND_LABELS: Record<MatchingBlocker["kind"], string> = {
  task: "Onboarding task",
  training: "Training",
  certification: "Certification",
};

function BlockerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-5 shrink-0 text-warning"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

export function BlockerList({ blockers }: { blockers: MatchingBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <p className="flex max-w-prose items-center gap-2 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 shrink-0 text-success"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        No outstanding requirements — this enrollment is ready for matching.
      </p>
    );
  }

  return (
    <ul aria-label="Outstanding requirements" className="flex max-w-2xl flex-col gap-2">
      {blockers.map((blocker) => (
        <li
          key={`${blocker.kind}-${blocker.id}`}
          className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
        >
          <BlockerIcon />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium">
              {KIND_LABELS[blocker.kind]}: {blocker.label}
            </p>
            <p className="text-xs text-base-content/60">{blocker.detail}</p>
          </div>
          <a
            href={blocker.anchor}
            className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
          >
            Go to {KIND_LABELS[blocker.kind].toLowerCase()}s
          </a>
        </li>
      ))}
    </ul>
  );
}
