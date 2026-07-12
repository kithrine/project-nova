"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DecisionFormState } from "@/features/review/actions";
import {
  DISQUALIFICATION_CATEGORIES,
  ORDINARY_REJECTION_CATEGORIES,
} from "@/features/review/decision-categories";

/**
 * Application Decision + Confirmation Panel (Story 2.11;
 * docs/ux/component-guidelines.md). Terminal decisions are largely
 * irreversible, so recording one takes an explicit reason category AND an
 * explicit confirmation — an accessible in-page confirm/cancel pattern,
 * never a bare browser dialog. Applicant-facing wording comes from the
 * approved templates (ADR-016), never from anything typed here; the
 * category alone determines REJECTED vs DISQUALIFIED.
 */
export function DecisionPanel({
  canAccept,
  canReject,
  acceptDisabledReason,
  acceptAction,
  rejectAction,
  initialRejectState = { status: "idle" },
}: {
  canAccept: boolean;
  canReject: boolean;
  /** Non-null while accept's business prerequisite is unmet (2.10's Clear outcome). */
  acceptDisabledReason: string | null;
  acceptAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  rejectAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  initialRejectState?: DecisionFormState;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectAction,
    initialRejectState,
  );
  const [acceptState, acceptFormAction, acceptPending] = useActionState(acceptAction, {
    status: "idle",
  });

  if (!canAccept && !canReject) return null;

  return (
    <section aria-labelledby="decision-heading" className="flex flex-col gap-3">
      <h2 id="decision-heading" className="text-base font-semibold">
        Decision
      </h2>

      {rejectState.status === "decided" || acceptState.status === "decided" ? (
        <p role="status" className="max-w-prose rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm">
          Decision recorded. The applicant sees only the approved, respectful
          messaging for this outcome.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {canAccept ? (
              <form action={acceptFormAction}>
                <Button
                  type="submit"
                  disabled={Boolean(acceptDisabledReason) || acceptPending}
                  aria-describedby={acceptDisabledReason ? "accept-blocked-reason" : undefined}
                >
                  {acceptPending ? "Accepting…" : "Accept Application"}
                </Button>
              </form>
            ) : null}
            {canReject ? (
              <button
                type="button"
                aria-expanded={rejectOpen}
                aria-controls="reject-panel"
                onClick={() => setRejectOpen((open) => !open)}
                className="rounded-md border border-error/40 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/5"
              >
                Reject Application…
              </button>
            ) : null}
          </div>

          {canAccept && acceptDisabledReason ? (
            <p id="accept-blocked-reason" className="max-w-prose text-sm text-base-content/60">
              Accept is not available yet: {acceptDisabledReason}.
            </p>
          ) : null}

          {acceptState.status === "error" && acceptState.formError ? (
            <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {acceptState.formError}
            </p>
          ) : null}

          {rejectOpen ? (
            <form
              id="reject-panel"
              action={rejectFormAction}
              className="flex max-w-prose flex-col gap-4 rounded-lg border border-base-300 bg-base-100 p-5"
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold">Reason category</legend>
                <p className="text-sm text-base-content/60">
                  Ordinary rejection — the applicant may apply again 30 days after
                  the decision:
                </p>
                {Object.entries(ORDINARY_REJECTION_CATEGORIES).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="category"
                      value={key}
                      className="mt-0.5"
                      onChange={() => setCategory(key)}
                    />
                    {label}
                  </label>
                ))}
                <p className="mt-2 text-sm font-medium text-error">
                  Permanent disqualification (ADR-016) — blocks all future
                  applications. Only these three reasons qualify:
                </p>
                {Object.entries(DISQUALIFICATION_CATEGORIES).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="category"
                      value={key}
                      className="mt-0.5"
                      onChange={() => setCategory(key)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I understand this decision is final — terminal applications are never
                reopened, and the applicant will see the approved messaging for this
                outcome.
              </label>

              {rejectState.status === "error" && rejectState.formError ? (
                <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
                  {rejectState.formError}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!category || !confirmed || rejectPending}>
                  {rejectPending ? "Recording…" : "Record Decision"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectOpen(false);
                    setCategory(null);
                    setConfirmed(false);
                  }}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
