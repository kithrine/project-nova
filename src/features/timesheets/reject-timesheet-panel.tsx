"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  rejectTimesheetAction,
  type TimesheetFormState,
} from "@/features/timesheets/actions";

/**
 * The Reject action (Story 6.6): opens an accessible required-reason
 * field — the participant sees this text verbatim, so the label says
 * so. Shares the review surface and standing rule with approval.
 */
export function RejectTimesheetPanel({ timesheetId }: { timesheetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    rejectTimesheetAction.bind(null, timesheetId),
    { status: "idle" } as TimesheetFormState,
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        Request Correction…
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 px-4 py-3"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        What needs correction? (required — the participant sees this)
        <textarea
          name="reason"
          rows={2}
          required
          className="textarea textarea-bordered w-full font-normal"
          placeholder="For example: Thursday looks like two shifts — please split it."
        />
      </label>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Yes, Request Correction"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
