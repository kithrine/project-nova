"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  recordShelterDecisionAction,
  type MatchFormState,
} from "@/features/matching/actions";
import type { ShelterDecisionChoice } from "@/server/services/matching-service";

/**
 * Approve / Request Changes / Decline on a Placement approvals row (Story
 * 4.6; docs/ux/content-style-guide.md verb-first actions). Manager-only —
 * the card renders these solely when viewerCanDecide. Each choice goes
 * through a confirmation step with managed focus; Request Changes and
 * Decline REQUIRE a note so the coordinator has something actionable, and
 * the note is operational only — participant background information is
 * never requested or shared here.
 */

const CHOICE_COPY: Record<
  ShelterDecisionChoice,
  { confirmTitle: string; confirmBody: string; submitLabel: string }
> = {
  APPROVED: {
    confirmTitle: "Approve this placement?",
    confirmBody:
      "You're approving this arrangement for your organization. Nova gives the match a final review once the participant has also accepted.",
    submitLabel: "Yes, Approve",
  },
  CHANGE_REQUESTED: {
    confirmTitle: "Request changes to this placement?",
    confirmBody:
      "The match returns to the Nova coordinator with your note, and comes back to you once it's revised.",
    submitLabel: "Yes, Request Changes",
  },
  DECLINED: {
    confirmTitle: "Decline this placement?",
    confirmBody:
      "This is final for this proposal — the coordinator sees your note and can explore a different arrangement.",
    submitLabel: "Yes, Decline",
  },
};

export function ShelterDecisionControls({ matchId }: { matchId: string }) {
  const [choice, setChoice] = useState<ShelterDecisionChoice | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: MatchFormState, formData: FormData) =>
      recordShelterDecisionAction(matchId, choice ?? "APPROVED", prev, formData),
    { status: "idle" } as MatchFormState,
  );

  // Managed focus into and out of the confirmation step; skipped on mount
  // so page load never steals focus.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (choice === null) {
      idleRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }
  }, [choice]);

  if (choice !== null) {
    const copy = CHOICE_COPY[choice];
    const noteRequired = choice !== "APPROVED";
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-200/40 p-3 outline-none"
      >
        <p className="text-sm font-medium">{copy.confirmTitle}</p>
        <p className="text-xs text-base-content/70">{copy.confirmBody}</p>
        <form action={formAction} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`shelter-note-${matchId}`}
              className="text-xs font-medium"
            >
              {noteRequired
                ? "Note for the coordinator (required)"
                : "Note for the coordinator (optional)"}
            </label>
            <textarea
              id={`shelter-note-${matchId}`}
              name="note"
              rows={2}
              required={noteRequired}
              aria-describedby={
                state.status === "error" ? `shelter-decision-error-${matchId}` : undefined
              }
              className="textarea textarea-bordered w-full text-sm"
              placeholder={
                noteRequired
                  ? "Operational details only — schedule, supervisor, or site."
                  : ""
              }
            />
          </div>
          {state.status === "error" && state.formError ? (
            <p
              id={`shelter-decision-error-${matchId}`}
              role="alert"
              className="text-sm text-error"
            >
              {state.formError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              size="sm"
              aria-disabled={pending}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
              className="w-full sm:w-auto"
            >
              {pending ? "Saving…" : copy.submitLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setChoice(null)}
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
    <div
      ref={idleRef}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none sm:flex-row"
    >
      <Button
        type="button"
        size="sm"
        onClick={() => setChoice("APPROVED")}
        className="w-full sm:w-auto"
      >
        Approve Placement
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setChoice("CHANGE_REQUESTED")}
        className="w-full sm:w-auto"
      >
        Request Changes
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setChoice("DECLINED")}
        className="w-full sm:w-auto"
      >
        Decline Placement
      </Button>
    </div>
  );
}
