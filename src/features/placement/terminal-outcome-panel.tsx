"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  recordTerminalOutcomeAction,
  type PlacementFormState,
} from "@/features/placement/actions";

/**
 * Terminal outcomes (Story 5.8; ADR-018): four distinct, clearly labeled
 * Status Transition Controls — never a generic status dropdown
 * (RULES.md) — each opening its own Confirmation Panel that names the
 * irreversible nature of the choice. Terminate renders only for
 * placement.terminate holders and requires a reason category and note.
 */

type OutcomeKey = "COMPLETED" | "CONVERTED_TO_PERMANENT" | "WITHDRAWN" | "TERMINATED";

const OUTCOMES: Record<
  OutcomeKey,
  { open: string; confirm: string; finality: string }
> = {
  COMPLETED: {
    open: "Mark Completed…",
    confirm: "Yes, Mark Completed",
    finality:
      "This records a successful natural end. It is final — completed placements are never reopened.",
  },
  CONVERTED_TO_PERMANENT: {
    open: "Record Permanent Hire…",
    confirm: "Yes, Record Permanent Hire",
    finality:
      "This ends the transitional placement and creates the Employment Outcome record. It is final.",
  },
  WITHDRAWN: {
    open: "Record Withdrawal…",
    confirm: "Yes, Record Withdrawal",
    finality:
      "This records the participant's own decision to leave. It is final — withdrawn placements are never reopened.",
  },
  TERMINATED: {
    open: "Terminate Placement…",
    confirm: "Yes, Terminate Placement",
    finality:
      "This is the involuntary end of the placement. It is final and cannot be undone.",
  },
};

function OutcomeForm({
  placementId,
  outcome,
  employerDefault,
  reasonOptions,
  onCancel,
}: {
  placementId: string;
  outcome: OutcomeKey;
  employerDefault: string;
  reasonOptions: readonly { key: string; label: string }[];
  onCancel: () => void;
}) {
  const copy = OUTCOMES[outcome];
  const [state, formAction, pending] = useActionState(
    recordTerminalOutcomeAction.bind(null, placementId, outcome),
    { status: "idle" } as PlacementFormState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-warning/50 bg-warning/5 px-4 py-3"
    >
      <p className="text-sm font-medium">{copy.finality}</p>
      <label className="flex flex-col gap-1 text-sm">
        Effective date
        <input
          type="date"
          name="effectiveDate"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="input input-bordered w-fit"
        />
      </label>

      {outcome === "CONVERTED_TO_PERMANENT" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Hired by
            <input
              type="text"
              name="employerName"
              required
              defaultValue={employerDefault}
              className="input input-bordered w-full max-w-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Job title (optional)
            <input
              type="text"
              name="jobTitle"
              className="input input-bordered w-full max-w-sm"
            />
          </label>
        </>
      ) : null}

      {outcome === "TERMINATED" ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Reason category</legend>
          <div className="flex flex-col gap-1">
            {reasonOptions.map((option) => (
              <label key={option.key} className="flex items-center gap-1.5 text-sm">
                <input type="radio" name="reasonCategory" value={option.key} required />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        {outcome === "WITHDRAWN"
          ? "Participant's stated reason (required)"
          : outcome === "TERMINATED"
            ? "What happened (required)"
            : "Summary (optional)"}
        <textarea
          name="note"
          rows={2}
          required={outcome === "WITHDRAWN" || outcome === "TERMINATED"}
          className="textarea textarea-bordered w-full"
        />
      </label>

      {state.status === "error" && state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : copy.confirm}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function TerminalOutcomePanel({
  placementId,
  canTerminate,
  employerDefault,
  reasonOptions,
}: {
  placementId: string;
  canTerminate: boolean;
  employerDefault: string;
  reasonOptions: readonly { key: string; label: string }[];
}) {
  const [open, setOpen] = useState<OutcomeKey | null>(null);
  const available: OutcomeKey[] = [
    "COMPLETED",
    "CONVERTED_TO_PERMANENT",
    "WITHDRAWN",
    ...(canTerminate ? (["TERMINATED"] as OutcomeKey[]) : []),
  ];

  return (
    <section className="flex max-w-2xl flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <h2 className="text-sm font-semibold">End this placement</h2>
      <p className="text-sm text-base-content/70">
        Each outcome is recorded with its reason and effective date, and is
        final.
      </p>
      {open === null ? (
        <div className="flex flex-wrap gap-2">
          {available.map((outcome) => (
            <Button
              key={outcome}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(outcome)}
            >
              {OUTCOMES[outcome].open}
            </Button>
          ))}
        </div>
      ) : (
        <OutcomeForm
          placementId={placementId}
          outcome={open}
          employerDefault={employerDefault}
          reasonOptions={reasonOptions}
          onCancel={() => setOpen(null)}
        />
      )}
    </section>
  );
}
