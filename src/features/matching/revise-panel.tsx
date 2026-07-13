"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { reproposeMatchAction, type MatchFormState } from "@/features/matching/actions";

/**
 * The Change Requested -> Proposed Status Transition Control (Story 4.7).
 * Disabled — never hidden — with the missing core fields named while the
 * revised terms are incomplete; the server re-checks the same gate. Both
 * decision tracks reset to Pending on re-propose: the terms changed, so
 * prior consent cannot carry over.
 */
export function RevisePanel({
  matchId,
  missingFields,
}: {
  matchId: string;
  missingFields: string[];
}) {
  const [state, formAction, pending] = useActionState(
    reproposeMatchAction.bind(null, matchId),
    { status: "idle" } as MatchFormState,
  );
  const ready = missingFields.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-base-300 pt-4">
      <h2 className="text-sm font-semibold">Re-propose to both parties</h2>
      <p id="repropose-hint" className="max-w-prose text-sm text-base-content/70">
        {ready
          ? "Re-proposing shares the revised details with the participant and the shelter — both review it fresh, with new decision windows."
          : `Complete these first: ${missingFields.join("; ")}.`}
      </p>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!ready || pending}
        aria-describedby="repropose-hint"
        className="w-fit"
      >
        {pending ? "Re-proposing…" : "Re-propose Match"}
      </Button>
    </form>
  );
}
