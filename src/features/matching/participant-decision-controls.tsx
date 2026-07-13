"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  recordParticipantDecisionAction,
  type MatchFormState,
} from "@/features/matching/actions";

/**
 * Accept/Decline controls on the participant's Proposed Placement Card
 * (Story 4.5; docs/ux/content-style-guide.md). Both choices are final for
 * the current proposal, so each goes through an explicit confirmation step
 * with managed focus; the decline confirmation offers an optional,
 * non-interrogative note. Mobile-first — this is primarily a phone action.
 * The result state renders server-side after the action revalidates.
 */

type Phase = "idle" | "confirm-accept" | "confirm-decline";

export function ParticipantDecisionControls({
  matchId,
  organizationName,
}: {
  matchId: string;
  organizationName: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const confirmRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);

  const [acceptState, acceptFormAction, acceptPending] = useActionState(
    recordParticipantDecisionAction.bind(null, matchId, "ACCEPTED"),
    { status: "idle" } as MatchFormState,
  );
  const [declineState, declineFormAction, declinePending] = useActionState(
    recordParticipantDecisionAction.bind(null, matchId, "DECLINED"),
    { status: "idle" } as MatchFormState,
  );

  // Managed focus (UX: accessible confirmation with managed focus): moving
  // into a confirmation step focuses it; going back returns to the choices.
  // Skipped on mount so page load never steals focus from the document.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (phase === "idle") {
      idleRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }
  }, [phase]);

  const pending = acceptPending || declinePending;
  const error =
    acceptState.status === "error"
      ? acceptState.formError
      : declineState.status === "error"
        ? declineState.formError
        : null;

  if (phase === "confirm-accept") {
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4 outline-none"
      >
        <p className="text-sm font-medium">
          You&apos;re accepting this placement at {organizationName}.
        </p>
        <p className="text-sm text-base-content/70">
          This is final for this proposal — after the shelter and Nova finish
          their review, we&apos;ll help you get started.
        </p>
        {error ? (
          <p id="participant-decision-error" role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <form action={acceptFormAction} className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            aria-disabled={pending}
            aria-describedby={error ? "participant-decision-error" : undefined}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
            className="w-full sm:w-auto"
          >
            {acceptPending ? "Saving…" : "Yes, Accept This Placement"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setPhase("idle")}
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
        </form>
      </div>
    );
  }

  if (phase === "confirm-decline") {
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4 outline-none"
      >
        <p className="text-sm font-medium">
          You&apos;re declining this placement at {organizationName}.
        </p>
        <p className="text-sm text-base-content/70">
          That&apos;s okay — this is your choice to make. You&apos;ll stay in the
          program, and you may be matched with another opportunity.
        </p>
        <form action={declineFormAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="participant-decline-note" className="text-sm font-medium">
              Anything you&apos;d like us to know? (optional)
            </label>
            <textarea
              id="participant-decline-note"
              name="note"
              rows={3}
              className="textarea textarea-bordered w-full text-base"
              placeholder="Only if you'd like to share — it goes to your coordinator, not the shelter."
            />
          </div>
          {error ? (
            <p id="participant-decision-error" role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              aria-disabled={pending}
              aria-describedby={error ? "participant-decision-error" : undefined}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
              className="w-full sm:w-auto"
            >
              {declinePending ? "Saving…" : "Yes, Decline This Placement"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setPhase("idle")}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div ref={idleRef} tabIndex={-1} className="flex flex-col gap-2 outline-none sm:flex-row">
      <Button
        type="button"
        onClick={() => setPhase("confirm-accept")}
        className="w-full sm:w-auto"
      >
        Accept This Placement
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setPhase("confirm-decline")}
        className="w-full sm:w-auto"
      >
        Decline This Placement
      </Button>
    </div>
  );
}
