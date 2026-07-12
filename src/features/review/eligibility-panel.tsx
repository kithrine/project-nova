"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DecisionFormState } from "@/features/review/actions";
import { ELIGIBILITY_RUBRIC } from "@/features/review/eligibility-rubric";

/**
 * Eligibility Checklist + outcome form (Story 2.8; ADR-015;
 * docs/ux/component-guidelines.md). The checklist renders the ADR-015
 * intake rubric — the ONLY criteria a determination may weigh; offense
 * history never appears here. Recording an outcome requires a rationale
 * and an explicit confirmation. Not Eligible invokes the shared rejection
 * (2.11) — the applicant may reapply 30 days after the decision.
 */

export interface EligibilityReviewSummary {
  reviewerName: string;
  startedAtLabel: string;
  outcomeLabel: string | null;
  rationale: string | null;
  decidedAtLabel: string | null;
}

function Rubric() {
  return (
    <div className="flex max-w-prose flex-col gap-2">
      <h3 className="text-sm font-semibold">Eligibility rubric (ADR-015)</h3>
      <ul className="flex flex-col gap-1.5">
        {ELIGIBILITY_RUBRIC.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 size-4 shrink-0 text-base-content/50"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="text-sm text-base-content/60">
        Offense history is never part of eligibility — offense-related concerns belong
        to the background stage under the individualized-assessment rules.
      </p>
    </div>
  );
}

export function EligibilityPanel({
  status,
  review,
  canDecide,
  beginAction,
  recordAction,
  initialRecordState = { status: "idle" },
}: {
  status: string;
  review: EligibilityReviewSummary | null;
  canDecide: boolean;
  beginAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  recordAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  initialRecordState?: DecisionFormState;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [beginState, beginFormAction, beginPending] = useActionState(beginAction, {
    status: "idle",
  });
  const [recordState, recordFormAction, recordPending] = useActionState(
    recordAction,
    initialRecordState,
  );

  // Recorded: the internal summary (never shown to applicants or shelters).
  if (review?.outcomeLabel) {
    return (
      <div className="flex max-w-prose flex-col gap-3">
        <p className="text-base font-semibold">Outcome: {review.outcomeLabel}</p>
        <p className="text-sm text-base-content/70">
          Reviewed by {review.reviewerName} · started {review.startedAtLabel}
          {review.decidedAtLabel ? ` · decided ${review.decidedAtLabel}` : ""}
        </p>
        {review.rationale ? (
          <div className="rounded-md border border-base-300 bg-base-100 p-4">
            <p className="text-sm font-medium text-base-content/70">
              Internal rationale (never shown to the applicant or shelters)
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
              {review.rationale}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  // In progress: record the determination against the rubric.
  if (status === "ELIGIBILITY_REVIEW" && review) {
    if (!canDecide) {
      return (
        <p className="max-w-prose text-sm text-base-content/70">
          Eligibility review is in progress (started {review.startedAtLabel} by{" "}
          {review.reviewerName}).
        </p>
      );
    }
    return (
      <form action={recordFormAction} className="flex max-w-prose flex-col gap-5">
        <Rubric />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">Determination</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="outcome"
              value="ELIGIBLE"
              className="mt-0.5"
              onChange={() => setOutcome("ELIGIBLE")}
            />
            Eligible — advances to the interview phase
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="outcome"
              value="NOT_ELIGIBLE"
              className="mt-0.5"
              onChange={() => setOutcome("NOT_ELIGIBLE")}
            />
            Not eligible — invokes the shared rejection (the applicant may reapply
            30 days after the decision)
          </label>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="eligibility-rationale" className="text-sm font-medium">
            Rationale (internal)
          </label>
          <p className="text-sm text-base-content/60">
            Which rubric item drove the determination, and why. Never shown to the
            applicant or shelters.
          </p>
          <textarea
            id="eligibility-rationale"
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
          I evaluated this application against the ADR-015 rubric only.
        </label>

        {recordState.status === "error" && recordState.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {recordState.formError}
          </p>
        ) : null}

        <Button type="submit" disabled={!outcome || !confirmed || recordPending} className="w-fit">
          {recordPending ? "Recording…" : "Record Eligibility Outcome"}
        </Button>
      </form>
    );
  }

  // Not started: offer Begin on a submitted application.
  if (status === "SUBMITTED" && canDecide) {
    return (
      <div className="flex max-w-prose flex-col gap-4">
        <Rubric />
        {beginState.status === "error" && beginState.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {beginState.formError}
          </p>
        ) : null}
        <form action={beginFormAction}>
          <Button type="submit" disabled={beginPending}>
            {beginPending ? "Beginning…" : "Begin Eligibility Review"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <p className="max-w-prose text-sm text-base-content/70">
      No eligibility review has been recorded for this application.
    </p>
  );
}
