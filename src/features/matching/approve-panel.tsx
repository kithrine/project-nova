"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { approveMatchAction, type MatchFormState } from "@/features/matching/actions";

/**
 * The final approval gate (Story 4.8; docs/ux/component-guidelines.md
 * Blocker List). While prerequisites are outstanding, each is NAMED with
 * text + icon and the action stays disabled — never hidden. When both
 * decisions are favorable, an explicit confirmation precedes the
 * irreversible transactional action (ADR-011: a human takes it). The
 * Concurrent-update state renders through the error path when the
 * conflicting-placement re-check blocks the commit.
 */
export function ApprovePanel({
  matchId,
  blockers,
}: {
  matchId: string;
  blockers: string[];
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    approveMatchAction.bind(null, matchId),
    { status: "idle" } as MatchFormState,
  );
  const eligible = blockers.length === 0;

  return (
    <form
      action={formAction}
      className="flex max-w-prose flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
    >
      <h2 className="text-sm font-semibold">Final approval</h2>
      {eligible ? (
        <>
          <p className="text-sm text-base-content/70">
            The participant accepted and the shelter approved. Approving closes
            this match and creates the placement record — the shelter then
            reviews the specific site, supervisor, and schedule package before
            onboarding begins.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Both parties agreed and I&apos;m approving this match — this creates
            the placement and can&apos;t be undone.
          </label>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p id="approve-blockers-heading" className="text-sm text-base-content/70">
            Approval is waiting on:
          </p>
          <ul
            aria-labelledby="approve-blockers-heading"
            className="flex flex-col gap-1"
          >
            {blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex items-start gap-1.5 text-sm text-base-content/80"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4.5M12 15.5v.5" />
                </svg>
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.status === "error" && state.formError ? (
        <p
          id="approve-error"
          role="alert"
          className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm"
        >
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!eligible || !confirmed || pending}
        aria-describedby={state.status === "error" ? "approve-error" : undefined}
        className="w-fit"
      >
        {pending ? "Approving…" : "Approve Match"}
      </Button>
    </form>
  );
}
