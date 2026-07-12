"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  completeOwnTaskAction,
  type TaskActionState,
} from "@/features/enrollment/actions";
import type {
  ParticipantOnboardingSummary,
  ParticipantTaskView,
} from "@/server/services/enrollment-service";

/**
 * The participant dashboard's Required tasks card (Story 3.3;
 * docs/ux/wireframes-layouts.md). Live progress in plain, respectful
 * language; each completable task gets a keyboard-operable control whose
 * accessible name includes the task itself. Staff-only tasks read as
 * pending with a calm explanation — never a broken or missing action.
 */

function TaskRow({ task }: { task: ParticipantTaskView }) {
  const [state, formAction, pending] = useActionState(
    completeOwnTaskAction.bind(null, task.id),
    { status: "idle" } as TaskActionState,
  );

  return (
    <li className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      {task.status === "COMPLETE" ? (
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
      ) : (
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
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium">{task.title}</p>
        <p className="text-sm text-base-content/70">{task.description}</p>
        {task.status === "COMPLETE" ? (
          <p className="text-xs text-base-content/60">
            Complete{task.completedAtLabel ? ` · ${task.completedAtLabel}` : ""}
          </p>
        ) : task.participantCompletable ? (
          <p className="text-xs text-base-content/60">
            Not started — you can do this one whenever you&apos;re ready.
          </p>
        ) : (
          <p className="text-xs text-base-content/60">
            Nova staff will take care of this one — nothing is needed from you.
          </p>
        )}
        {task.status === "NOT_STARTED" && state.status === "error" && state.formError ? (
          <p id={`own-task-error-${task.id}`} role="alert" className="text-sm text-error">
            {state.formError}
          </p>
        ) : null}
      </div>
      {task.status === "NOT_STARTED" && task.participantCompletable ? (
        <form action={formAction}>
          {/* aria-disabled keeps focus during the action so "Saving…" is
              announced; the guard prevents a double submit. */}
          <Button
            type="submit"
            aria-disabled={pending}
            aria-describedby={
              state.status === "error" ? `own-task-error-${task.id}` : undefined
            }
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
            className="whitespace-nowrap"
          >
            {pending ? "Saving…" : `Mark Done: ${task.title}`}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function ParticipantTasks({ summary }: { summary: ParticipantOnboardingSummary }) {
  const remaining = summary.totalCount - summary.completeCount;

  return (
    <section aria-labelledby="onboarding-tasks-heading" className="flex flex-col gap-3">
      <h2 id="onboarding-tasks-heading" className="text-lg font-semibold">
        Your onboarding tasks
      </h2>
      <p role="status" className="max-w-prose text-sm text-base-content/70">
        {remaining === 0
          ? `All ${summary.totalCount} tasks are complete — wonderful. Our team will take it from here.`
          : `${summary.completeCount} of ${summary.totalCount} complete · ${remaining} to go — at your own pace.`}
      </p>
      <ul className="flex max-w-2xl flex-col gap-2">
        {summary.tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  );
}
