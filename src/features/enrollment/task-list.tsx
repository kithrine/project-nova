import type { OnboardingTaskView } from "@/server/services/enrollment-service";

/**
 * Task List (Story 3.2; docs/ux/component-guidelines.md) — the Enrollment
 * workspace's onboarding checklist. Status is text + SVG icon together,
 * never color alone; badges spell out required/optional and who can
 * complete the task. Read-only in 3.2 — completion arrives with 3.3.
 */

function StatusIcon({ status }: { status: OnboardingTaskView["status"] }) {
  if (status === "COMPLETE") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-5 shrink-0 text-success"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
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
      className="mt-0.5 size-5 shrink-0 text-base-content/40"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function TaskList({ tasks }: { tasks: OnboardingTaskView[] }) {
  if (tasks.length === 0) {
    return (
      <p className="max-w-prose text-sm text-base-content/70">
        No onboarding tasks exist for this enrollment.
      </p>
    );
  }

  return (
    <ul className="flex max-w-2xl flex-col gap-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
        >
          <StatusIcon status={task.status} />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{task.title}</p>
            <p className="text-sm text-base-content/70">{task.description}</p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
              <span className="font-medium">{task.statusLabel}</span>
              <span>{task.required ? "Required" : "Optional"}</span>
              <span>
                {task.participantCompletable
                  ? "Participant can complete"
                  : "Recorded by Nova staff"}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
