"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  updateMatchDraftAction,
  withdrawMatchDraftAction,
  type MatchFormState,
} from "@/features/matching/actions";
import type { MatchWorkspaceView } from "@/server/services/matching-service";

/**
 * Draft match form (Story 4.3; docs/ux/component-guidelines.md Form Field /
 * Select / Date Input primitives). Editable only while DRAFT — the server
 * re-evaluates the compatibility snapshot against every save. Withdrawing
 * is explicit and confirmed; drafts are coordinator-internal.
 */

export function MatchDraftForm({
  match,
  initialState = { status: "idle" },
}: {
  match: MatchWorkspaceView;
  initialState?: MatchFormState;
}) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [saveState, saveFormAction, savePending] = useActionState(
    updateMatchDraftAction.bind(null, match.id),
    initialState,
  );
  const [withdrawState, withdrawFormAction, withdrawPending] = useActionState(
    withdrawMatchDraftAction.bind(null, match.id),
    { status: "idle" } as MatchFormState,
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form action={saveFormAction} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Candidate arrangement</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="draft-site" className="text-sm font-medium">
            Shelter site
          </label>
          <select
            id="draft-site"
            name="siteId"
            defaultValue={match.siteId}
            required
            className="w-fit rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            {match.siteOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="draft-supervisor" className="text-sm font-medium">
            Candidate supervisor
          </label>
          <select
            id="draft-supervisor"
            name="supervisorId"
            defaultValue={match.supervisorId ?? ""}
            className="w-fit rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            <option value="">Not selected yet</option>
            {match.supervisorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-base-content/60">
            Active shelter supervisors at {match.organizationName}.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="draft-schedule" className="text-sm font-medium">
            Candidate schedule
          </label>
          <input
            id="draft-schedule"
            name="schedule"
            defaultValue={match.schedule ?? ""}
            placeholder="e.g. Mon/Wed/Fri mornings, 9am–1pm"
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="draft-start" className="text-sm font-medium">
              Candidate start date
            </label>
            <input
              id="draft-start"
              type="date"
              name="startDate"
              defaultValue={match.startDateValue ?? ""}
              className="rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="draft-end" className="text-sm font-medium">
              Candidate end date
            </label>
            <input
              id="draft-end"
              type="date"
              name="endDate"
              defaultValue={match.endDateValue ?? ""}
              className="rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="draft-funding" className="text-sm font-medium">
            Candidate funding source
          </label>
          <select
            id="draft-funding"
            name="fundingSourceId"
            defaultValue={match.fundingSourceId ?? ""}
            className="w-fit rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            <option value="">Not selected yet</option>
            {match.fundingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="draft-notes" className="text-sm font-medium">
            Coordinator notes (internal)
          </label>
          <textarea
            id="draft-notes"
            name="notes"
            rows={3}
            defaultValue={match.notes ?? ""}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
        </div>

        {saveState.status === "error" && saveState.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {saveState.formError}
          </p>
        ) : null}
        {saveState.status === "saved" ? (
          <p role="status" className="rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
            Draft saved — the compatibility read below reflects these details.
          </p>
        ) : null}

        <Button type="submit" disabled={savePending} className="w-fit">
          {savePending ? "Saving…" : "Save Draft Details"}
        </Button>
      </form>

      <form action={withdrawFormAction} className="flex flex-col gap-2 border-t border-base-300 pt-4">
        <h2 className="text-sm font-semibold">Withdraw this draft</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmWithdraw}
            onChange={(event) => setConfirmWithdraw(event.target.checked)}
          />
          I no longer want to pursue this match — withdrawing is final.
        </label>
        {withdrawState.status === "error" && withdrawState.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {withdrawState.formError}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={!confirmWithdraw || withdrawPending}
          className="w-fit"
        >
          {withdrawPending ? "Withdrawing…" : "Withdraw Draft"}
        </Button>
      </form>
    </div>
  );
}
