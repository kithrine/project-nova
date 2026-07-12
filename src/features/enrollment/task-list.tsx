"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  reopenTaskAction,
  staffCompleteTaskAction,
  type TaskActionState,
} from "@/features/enrollment/actions";
import type { OnboardingTaskView } from "@/server/services/enrollment-service";

/**
 * Task List (Stories 3.2/3.3; docs/ux/component-guidelines.md) — the
 * Enrollment workspace's onboarding checklist. Status is text + SVG icon
 * together, never color alone. With ops permissions, each row carries its
 * Status Transition Control: complete (any task, including staff-only) and
 * reopen (corrective, audited) — every control's accessible name includes
 * the specific task, never a bare "Complete".
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

export interface TaskListOpsControls {
  enrollmentId: string;
  canComplete: boolean;
  canReopen: boolean;
}

function OpsTaskRow({
  task,
  ops,
}: {
  task: OnboardingTaskView;
  ops: TaskListOpsControls;
}) {
  const [completeState, completeFormAction, completePending] = useActionState(
    staffCompleteTaskAction.bind(null, ops.enrollmentId, task.id),
    { status: "idle" } as TaskActionState,
  );
  const [reopenState, reopenFormAction, reopenPending] = useActionState(
    reopenTaskAction.bind(null, ops.enrollmentId, task.id),
    { status: "idle" } as TaskActionState,
  );
  // Each error is gated on the status its action applies to, so a stale
  // alert never contradicts a row the server has since refreshed.
  const completeError =
    task.status === "NOT_STARTED" && completeState.status === "error"
      ? (completeState.formError ?? null)
      : null;
  const reopenError =
    task.status === "COMPLETE" && reopenState.status === "error"
      ? (reopenState.formError ?? null)
      : null;

  return (
    <li className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <StatusIcon status={task.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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
          {task.completedAtLabel ? (
            <span>
              Completed {task.completedAtLabel}
              {task.completedByName ? ` by ${task.completedByName}` : ""}
            </span>
          ) : null}
        </p>
        {completeError ? (
          <p id={`task-complete-error-${task.id}`} role="alert" className="text-sm text-error">
            {completeError}
          </p>
        ) : null}
        {reopenError ? (
          <p id={`task-reopen-error-${task.id}`} role="alert" className="text-sm text-error">
            {reopenError}
          </p>
        ) : null}
      </div>
      {task.status === "NOT_STARTED" && ops.canComplete ? (
        <form action={completeFormAction}>
          {/* aria-disabled keeps focus (a hard disable drops it to <body>)
              so "Completing…" is announced; the guard prevents re-submit. */}
          <Button
            type="submit"
            aria-disabled={completePending}
            aria-describedby={completeError ? `task-complete-error-${task.id}` : undefined}
            onClick={(event) => {
              if (completePending) event.preventDefault();
            }}
            className="whitespace-nowrap"
          >
            {completePending ? "Completing…" : `Complete: ${task.title}`}
          </Button>
        </form>
      ) : null}
      {task.status === "COMPLETE" && ops.canReopen ? (
        <form action={reopenFormAction}>
          <button
            type="submit"
            aria-disabled={reopenPending}
            aria-describedby={reopenError ? `task-reopen-error-${task.id}` : undefined}
            onClick={(event) => {
              if (reopenPending) event.preventDefault();
            }}
            className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
          >
            {reopenPending ? "Reopening…" : `Reopen: ${task.title}`}
          </button>
        </form>
      ) : null}
    </li>
  );
}

export function TaskList({
  tasks,
  ops,
}: {
  tasks: OnboardingTaskView[];
  /** Present = render the staff Status Transition Controls (Story 3.3). */
  ops?: TaskListOpsControls;
}) {
  if (tasks.length === 0) {
    return (
      <p className="max-w-prose text-sm text-base-content/70">
        No onboarding tasks exist for this enrollment.
      </p>
    );
  }

  return (
    <ul className="flex max-w-2xl flex-col gap-2">
      {tasks.map((task) =>
        ops ? (
          <OpsTaskRow key={task.id} task={task} ops={ops} />
        ) : (
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
                {task.completedAtLabel ? <span>Completed {task.completedAtLabel}</span> : null}
              </p>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
