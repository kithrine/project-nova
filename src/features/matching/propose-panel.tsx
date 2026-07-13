"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { proposeMatchAction, type MatchFormState } from "@/features/matching/actions";

/**
 * The Draft -> Proposed Status Transition Control (Story 4.4). Disabled —
 * never hidden — with the missing core fields named while the draft is
 * incomplete; the server re-checks the same gate and names them too.
 */
export function ProposePanel({
  matchId,
  missingFields,
}: {
  matchId: string;
  missingFields: string[];
}) {
  const [state, formAction, pending] = useActionState(
    proposeMatchAction.bind(null, matchId),
    { status: "idle" } as MatchFormState,
  );
  const ready = missingFields.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-base-300 pt-4">
      <h2 className="text-sm font-semibold">Propose to both parties</h2>
      <p id="propose-hint" className="max-w-prose text-sm text-base-content/70">
        {ready
          ? "Proposing shares these details with the participant and the shelter, and opens both decision windows."
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
        aria-describedby="propose-hint"
        className="w-fit"
      >
        {pending ? "Proposing…" : "Propose Match"}
      </Button>
    </form>
  );
}
