"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  completeOwnPlacementTaskAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type { ParticipantStepView } from "@/server/services/placement-service";

/**
 * The participant's own placement-onboarding steps on My Placement
 * (Story 5.4 AC3): plain "complete before your first day" language,
 * accessible controls, status by text and icon.
 */

function StepRow({ step }: { step: ParticipantStepView }) {
  const [state, formAction, pending] = useActionState(
    completeOwnPlacementTaskAction.bind(null, step.id),
    { status: "idle" } as PlacementFormState,
  );
  const complete = step.status === "COMPLETE";

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
        <p className="text-sm font-medium">{step.title}</p>
        <p className="text-sm text-base-content/70">{step.description}</p>
        <p className="text-xs text-base-content/60">
          {complete ? "Done — thank you!" : "To do before your first day."}
        </p>
        {state.status === "error" && state.formError ? (
          <p role="alert" className="text-sm text-error">
            {state.formError}
          </p>
        ) : null}
      </div>
      {!complete ? (
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
            {pending ? "Saving…" : `Mark Done: ${step.title}`}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function ParticipantSteps({ steps }: { steps: ParticipantStepView[] }) {
  if (steps.length === 0) return null;
  const remaining = steps.filter((step) => step.status !== "COMPLETE").length;

  return (
    <section aria-labelledby="my-steps-heading" className="flex flex-col gap-3">
      <h2 id="my-steps-heading" className="text-lg font-semibold">
        Your steps before day one
      </h2>
      <p role="status" className="max-w-prose text-sm text-base-content/70">
        {remaining === 0
          ? "All your steps are done — wonderful. The rest is on us and the shelter."
          : `${remaining} to go — at your own pace, before your first day.`}
      </p>
      <ul className="flex max-w-2xl flex-col gap-2">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </ul>
    </section>
  );
}
