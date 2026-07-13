"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  recordParticipantDecisionAction,
  type MatchFormState,
} from "@/features/matching/actions";

/**
 * Coordinator-assisted recording of the participant's decision (Story 4.5
 * AC3) — for a decision communicated by phone or in person. The
 * confirmation checkbox is the explicit "I actually heard this from the
 * participant" step; the participant stays the decision owner and the
 * coordinator is recorded as the recording actor.
 */
export function AssistedDecisionPanel({ matchId }: { matchId: string }) {
  const [choice, setChoice] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: MatchFormState, formData: FormData) =>
      recordParticipantDecisionAction(
        matchId,
        choice === "DECLINED" ? "DECLINED" : "ACCEPTED",
        prev,
        formData,
      ),
    { status: "idle" } as MatchFormState,
  );

  return (
    <form
      action={formAction}
      className="flex max-w-prose flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
    >
      <h3 className="text-sm font-semibold">
        Record the participant&apos;s decision on their behalf
      </h3>
      <p className="text-sm text-base-content/70">
        For a decision the participant communicated by phone or in person. The
        decision stays theirs — you are recorded as having entered it.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">The participant&apos;s decision</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="assisted-decision"
            checked={choice === "ACCEPTED"}
            onChange={() => setChoice("ACCEPTED")}
          />
          The participant accepts this placement
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="assisted-decision"
            checked={choice === "DECLINED"}
            onChange={() => setChoice("DECLINED")}
          />
          The participant declines this placement
        </label>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="assisted-decision-note" className="text-sm font-medium">
          Note (optional — Operations-only, never shared with the shelter)
        </label>
        <textarea
          id="assisted-decision-note"
          name="note"
          rows={2}
          className="textarea textarea-bordered w-full text-sm"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I confirmed this decision with the participant — recording it is final
        for this proposal.
      </label>
      {state.status === "error" && state.formError ? (
        <p id="assisted-decision-error" role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!choice || !confirmed || pending}
        aria-describedby={
          state.status === "error" ? "assisted-decision-error" : undefined
        }
        className="w-fit"
      >
        {pending ? "Recording…" : "Record Participant Decision"}
      </Button>
    </form>
  );
}
