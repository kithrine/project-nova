"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  assignFundingAction,
  endFundingAssignmentAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type { FundingTabView } from "@/server/services/placement-service";

/**
 * The Funding tab (Story 5.3; docs/ux/component-guidelines.md Funding
 * Assignment Card): exactly one active assignment at a time (ADR-010),
 * history always visible and never deleted. Active vs ended is conveyed
 * with text and icon; amounts are right-aligned and unit-labeled. Write
 * controls render only for Nova viewers holding funding.assign — and the
 * server enforces the same gate regardless of client state.
 */

function AssignmentCard({
  assignment,
}: {
  assignment: FundingTabView["history"][number];
}) {
  const active = assignment.statusLabel === "Active";
  return (
    <li className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{assignment.fundingSourceName}</p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-base-content/70">
          {active ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 shrink-0 text-success"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4 shrink-0 text-base-content/40"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12h8" />
            </svg>
          )}
          {assignment.statusLabel}
        </p>
      </div>
      <p className="text-xs text-base-content/60">
        {assignment.startDateLabel}
        {assignment.endDateLabel ? ` – ${assignment.endDateLabel}` : " – present"}
      </p>
      {assignment.hourlyRate || assignment.hoursCap ? (
        <dl className="flex flex-col gap-0.5 text-xs">
          {assignment.hourlyRate ? (
            <div className="flex max-w-56 justify-between gap-4">
              <dt className="text-base-content/60">Hourly rate</dt>
              <dd className="text-right font-medium tabular-nums">
                ${assignment.hourlyRate}/hr
              </dd>
            </div>
          ) : null}
          {assignment.hoursCap ? (
            <div className="flex max-w-56 justify-between gap-4">
              <dt className="text-base-content/60">Hours cap</dt>
              <dd className="text-right font-medium tabular-nums">
                {assignment.hoursCap} hrs
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

export function FundingTab({
  placementId,
  funding,
}: {
  placementId: string;
  funding: FundingTabView;
}) {
  const [assignState, assignFormAction, assignPending] = useActionState(
    assignFundingAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );
  const [endState, endFormAction, endPending] = useActionState(
    endFundingAssignmentAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {funding.history.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No funding assignment yet. The placement&apos;s hours and costs are
          attributed once a funding source is assigned.
        </p>
      ) : (
        <ul aria-label="Funding assignments" className="flex flex-col gap-2">
          {funding.history.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </ul>
      )}

      {funding.viewerCanAssign && funding.active ? (
        <form action={endFormAction} className="flex flex-col gap-2 border-t border-base-300 pt-4">
          <h3 className="text-sm font-semibold">End the active assignment</h3>
          <p className="max-w-prose text-sm text-base-content/70">
            Ending keeps it in history; a replacement can then be assigned (for
            example, at a grant-year change).
          </p>
          <label htmlFor="funding-end-date" className="text-sm font-medium">
            End date
          </label>
          <input
            id="funding-end-date"
            name="endDate"
            type="date"
            required
            className="w-44 rounded-md border border-base-300 px-3 py-2 text-sm"
          />
          {endState.status === "error" && endState.formError ? (
            <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {endState.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={endPending} className="w-fit">
            {endPending ? "Ending…" : "End Assignment"}
          </Button>
        </form>
      ) : null}

      {funding.viewerCanAssign && !funding.active ? (
        <form action={assignFormAction} className="flex flex-col gap-3 border-t border-base-300 pt-4">
          <h3 className="text-sm font-semibold">Assign a funding source</h3>
          <div className="flex flex-col gap-1">
            <label htmlFor="funding-source" className="text-sm font-medium">
              Funding source
            </label>
            <select
              id="funding-source"
              name="fundingSourceId"
              required
              className="rounded-md border border-base-300 px-3 py-2 text-sm"
            >
              <option value="">Choose a source…</option>
              {funding.sourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="funding-start" className="text-sm font-medium">
              Effective start date
            </label>
            <input
              id="funding-start"
              name="startDate"
              type="date"
              required
              className="w-44 rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="funding-rate" className="text-sm font-medium">
              Hourly rate (optional, USD)
            </label>
            <input
              id="funding-rate"
              name="hourlyRate"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 18.50"
              className="w-44 rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="funding-cap" className="text-sm font-medium">
              Hours cap (optional)
            </label>
            <input
              id="funding-cap"
              name="hoursCap"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 320"
              className="w-44 rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
          {assignState.status === "error" && assignState.formError ? (
            <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {assignState.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={assignPending} className="w-fit">
            {assignPending ? "Assigning…" : "Assign Funding"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
