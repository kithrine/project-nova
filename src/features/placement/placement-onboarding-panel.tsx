"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  completePlacementTaskAction,
  initiatePlacementOnboardingAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type {
  PlacementOnboardingView,
  PlacementTaskView,
} from "@/server/services/placement-service";

/**
 * Placement onboarding in the workspace's blockers-and-actions region
 * (Story 5.4; ADR-017 Layer 2): the coordinator initiates it from
 * Approved (generating the site-specific task set and entering
 * Onboarding), then staff verify their tasks here — Nova staff any task,
 * shelter staff the shelter-verified ones. Status is text + icon; the
 * participant's own steps live on My Placement.
 */

function TaskRow({
  placementId,
  task,
  canComplete,
}: {
  placementId: string;
  task: PlacementTaskView;
  canComplete: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    completePlacementTaskAction.bind(null, placementId, task.id),
    { status: "idle" } as PlacementFormState,
  );
  const complete = task.status === "COMPLETE";

  return (
    <li className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      {complete ? (
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
        <p className="text-xs text-base-content/60">
          {complete
            ? `Complete${task.completedAtLabel ? ` · ${task.completedAtLabel}` : ""}${task.completedByName ? ` · ${task.completedByName}` : ""}`
            : task.participantCompletable
              ? "Participant step — completed from My Placement (or by the coordinator)."
              : "Not yet verified."}
          {!task.required ? " · Optional" : ""}
        </p>
        {state.status === "error" && state.formError ? (
          <p role="alert" className="text-sm text-error">
            {state.formError}
          </p>
        ) : null}
      </div>
      {!complete && canComplete ? (
        <form action={formAction}>
          <Button
            type="submit"
            size="sm"
            aria-disabled={pending}
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

export function PlacementOnboardingPanel({
  placementId,
  onboarding,
}: {
  placementId: string;
  onboarding: PlacementOnboardingView;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [initState, initFormAction, initPending] = useActionState(
    initiatePlacementOnboardingAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );

  if (onboarding.canInitiate) {
    return (
      <form
        action={initFormAction}
        className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4"
      >
        <h2 className="text-sm font-semibold">Start placement onboarding</h2>
        <p className="text-sm text-base-content/70">
          Generates this site&apos;s preparation checklist — safety orientation,
          site instruction, agreements, and supervisor-confirmed competency —
          and moves the placement into Onboarding.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          The package is approved and the site is ready to begin preparation.
        </label>
        {initState.status === "error" && initState.formError ? (
          <p role="alert" className="text-sm text-error">
            {initState.formError}
          </p>
        ) : null}
        <Button type="submit" disabled={!confirmed || initPending} className="w-fit">
          {initPending ? "Starting…" : "Start Onboarding"}
        </Button>
      </form>
    );
  }

  if (onboarding.tasks.length === 0) return null;

  const canComplete =
    onboarding.viewerCanCompleteAllTasks || onboarding.viewerCanCompleteShelterTasks;

  return (
    <section aria-labelledby="placement-onboarding-heading" className="flex flex-col gap-3">
      <h2 id="placement-onboarding-heading" className="text-lg font-semibold">
        Placement onboarding
      </h2>
      <p role="status" className="max-w-prose text-sm text-base-content/70">
        {onboarding.requiredRemaining === 0
          ? "All required steps are complete."
          : `${onboarding.requiredRemaining} required ${
              onboarding.requiredRemaining === 1 ? "step remains" : "steps remain"
            } before this placement can activate.`}
      </p>
      <ul className="flex max-w-2xl flex-col gap-2">
        {onboarding.tasks.map((task) => (
          <TaskRow
            key={task.id}
            placementId={placementId}
            task={task}
            canComplete={
              canComplete &&
              (onboarding.viewerCanCompleteAllTasks || !task.participantCompletable)
            }
          />
        ))}
      </ul>
    </section>
  );
}
