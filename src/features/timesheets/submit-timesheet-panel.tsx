"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  submitTimesheetAction,
  type TimesheetFormState,
} from "@/features/timesheets/actions";

/**
 * The Submit control (Story 6.4): disabled WITH its reason until an
 * entry exists — never hidden — then a confirmation step before the
 * largely committing action. Success re-renders the card from server
 * truth; the status note is announced via role="status" there.
 */
export function SubmitTimesheetPanel({
  timesheetId,
  disabledReason,
}: {
  timesheetId: string;
  disabledReason: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitTimesheetAction.bind(null, timesheetId),
    { status: "idle" } as TimesheetFormState,
  );

  if (disabledReason) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" disabled className="w-fit">
          Submit Hours
        </Button>
        <p className="text-sm text-base-content/70">{disabledReason}</p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button type="button" className="w-fit" onClick={() => setConfirming(true)}>
        Submit Hours…
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 px-4 py-3"
    >
      <p className="text-sm font-medium">
        Submit this week for review? You won&apos;t be able to edit your hours
        while your supervisor reviews them.
      </p>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Yes, Submit Hours"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
