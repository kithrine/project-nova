"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DecisionFormState } from "@/features/review/actions";

/**
 * Background decision form + restricted summary (Story 2.10). Rendered ONLY
 * inside the audited background-tab gate (2.7) for holders of the restricted
 * permissions. The rationale is Highly Restricted — it exists nowhere except
 * this panel. Recording is one step (the check itself is an external
 * process); a Disqualifying outcome must name its ADR-016 category —
 * ordinary "not cleared," or the single permanent possession-ban case.
 */

export interface BackgroundReviewSummary {
  reviewerName: string;
  outcomeLabel: string;
  rationale: string;
  recordedAtLabel: string;
}

export function BackgroundPanel({
  status,
  review,
  canDecide,
  recordAction,
}: {
  status: string;
  review: BackgroundReviewSummary | null;
  canDecide: boolean;
  recordAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(recordAction, { status: "idle" });

  if (review) {
    return (
      <div className="flex max-w-prose flex-col gap-3">
        <p className="text-base font-semibold">Outcome: {review.outcomeLabel}</p>
        <p className="text-sm text-base-content/70">
          Recorded by {review.reviewerName} · {review.recordedAtLabel}
        </p>
        <div className="rounded-md border border-base-300 bg-base-100 p-4">
          <p className="text-sm font-medium text-base-content/70">
            Restricted rationale — visible only here, never logged
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {review.rationale}
          </p>
        </div>
      </div>
    );
  }

  if (status !== "BACKGROUND_REVIEW" || !canDecide) {
    return (
      <p className="max-w-prose text-sm text-base-content/70">
        No background review has been recorded for this application.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex max-w-prose flex-col gap-5">
      <p className="text-sm text-base-content/70">
        Record the outcome of the externally conducted background check. The
        individualized-assessment obligations (ADR-015: six documented factors,
        pre-adverse notice, five-business-day hold) happen in that external process
        before anything is recorded here.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Outcome</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="outcome"
            value="CLEAR"
            className="mt-0.5"
            onChange={() => setOutcome("CLEAR")}
          />
          Clear — the application becomes eligible for acceptance (never auto-accepted)
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="outcome"
            value="DISQUALIFYING"
            className="mt-0.5"
            onChange={() => setOutcome("DISQUALIFYING")}
          />
          Disqualifying — invokes the shared rejection with the category below
        </label>
      </fieldset>

      {outcome === "DISQUALIFYING" ? (
        <fieldset className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/5 p-4">
          <legend className="px-1 text-sm font-semibold">Rejection category (ADR-016)</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="rejectionCategory" value="BACKGROUND" className="mt-0.5" />
            Not cleared — ordinary rejection; the applicant may reapply 30 days after
            the decision
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="rejectionCategory"
              value="PERMANENT_POSSESSION_BAN"
              className="mt-0.5"
            />
            Active PERMANENT court-ordered animal-possession ban (RCW 16.52.200) —
            permanent disqualification; blocks all future applications
          </label>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="background-rationale" className="text-sm font-medium">
          Restricted rationale
        </label>
        <p className="text-sm text-base-content/60">
          Held at the Highly Restricted classification — never logged, never shown
          outside this tab.
        </p>
        <textarea
          id="background-rationale"
          name="rationale"
          rows={3}
          required
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I&apos;m ready to record this decision — it is final and audited.
      </label>

      {state.status === "error" && state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" disabled={!outcome || !confirmed || pending} className="w-fit">
        {pending ? "Recording…" : "Record Background Decision"}
      </Button>
    </form>
  );
}
