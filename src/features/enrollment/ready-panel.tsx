"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  markReadyForMatchingAction,
  type TaskActionState,
} from "@/features/enrollment/actions";

/**
 * Status Transition Control for Training -> Ready for Matching (Story 3.7;
 * docs/ux/component-guidelines.md). Disabled — never hidden — with a text
 * explanation while blockers remain, so coordinators understand why. The
 * server re-runs the 3.6 gate inside the transition transaction regardless
 * of what this control believes.
 */

export function ReadyPanel({
  enrollmentId,
  ready,
  alreadyReady,
  initialState = { status: "idle" },
}: {
  enrollmentId: string;
  ready: boolean;
  alreadyReady: boolean;
  initialState?: TaskActionState;
}) {
  const [state, formAction, pending] = useActionState(
    markReadyForMatchingAction.bind(null, enrollmentId),
    initialState,
  );

  if (alreadyReady) {
    return (
      <p className="flex max-w-prose items-center gap-2 text-sm font-medium">
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
        Marked ready for matching — visible to placement matching (Epic 4).
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!ready || pending}
          aria-describedby="ready-hint"
        >
          {pending ? "Marking…" : "Mark Ready for Matching"}
        </Button>
        <p id="ready-hint" className="text-sm text-base-content/70">
          {ready
            ? "Every requirement is complete — this enrollment can move to matching."
            : "Resolve the outstanding requirements above first."}
        </p>
      </div>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
