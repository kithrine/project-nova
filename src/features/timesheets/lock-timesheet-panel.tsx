"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  lockTimesheetAction,
  type TimesheetFormState,
} from "@/features/timesheets/actions";

/**
 * The Lock action (Story 6.7): Nova finalization of an approved week —
 * confirmed with plain language that locking is final within this
 * workflow (corrections need the separate adjustment workflow, which
 * MVP does not include).
 */
export function LockTimesheetPanel({ timesheetId }: { timesheetId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    lockTimesheetAction.bind(null, timesheetId),
    { status: "idle" } as TimesheetFormState,
  );

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        onClick={() => setConfirming(true)}
      >
        Lock Hours…
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 px-4 py-3"
    >
      <p className="text-sm font-medium">
        Lock this week as final? Locked hours are what funding and reporting
        rely on — no further change is possible in this workflow.
      </p>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Locking…" : "Yes, Lock Hours"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
