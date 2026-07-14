"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  approveTimesheetAction,
  type TimesheetFormState,
} from "@/features/timesheets/actions";

/**
 * The Approve action (Story 6.5): explicit and confirmed — approval is
 * never inferred from viewing. Approval confirms the participant's
 * server-calculated hours as-is; entries are read-only here.
 */
export function ApproveTimesheetPanel({ timesheetId }: { timesheetId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    approveTimesheetAction.bind(null, timesheetId),
    { status: "idle" } as TimesheetFormState,
  );

  if (!confirming) {
    return (
      <Button type="button" className="w-fit" onClick={() => setConfirming(true)}>
        Approve Hours…
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 px-4 py-3"
    >
      <p className="text-sm font-medium">
        Approve this week&apos;s hours as recorded? This confirms them for the
        participant&apos;s record.
      </p>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Approving…" : "Yes, Approve Hours"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
