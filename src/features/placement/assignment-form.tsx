"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  proposePlacementPackageAction,
  saveAssignmentAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type {
  PlacementWorkspaceView,
  WorkspaceTab,
} from "@/server/services/placement-service";

/**
 * The review-package builder (Story 5.2): site, supervisor, coordinator
 * of record, and the working schedule — fully keyboard-operable form
 * controls, never drag-and-drop (docs/ux/accessibility.md). Selects name
 * their organization scope so limited options are self-explanatory.
 * Editable only while the placement is Draft; the propose control names
 * whatever the package still needs.
 */

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function AssignmentForm({ view }: { view: PlacementWorkspaceView }) {
  const options = view.assignmentOptions;
  const scheduled = new Map(
    (view.structuredSchedule?.days ?? []).map((entry) => [entry.day as string, entry]),
  );
  const [enabledDays, setEnabledDays] = useState<Set<string>>(
    new Set(scheduled.keys()),
  );
  const [saveState, saveFormAction, savePending] = useActionState(
    saveAssignmentAction.bind(null, view.id),
    { status: "idle" } as PlacementFormState,
  );
  const [proposeState, proposeFormAction, proposePending] = useActionState(
    proposePlacementPackageAction.bind(null, view.id),
    { status: "idle" } as PlacementFormState,
  );

  if (!options) return null;
  const ready = view.packageMissing.length === 0;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form action={saveFormAction} className="flex flex-col gap-4">
        <h3 className="text-base font-semibold">Review package</h3>

        <div className="flex flex-col gap-1">
          <label htmlFor="assign-site" className="text-sm font-medium">
            Site <span className="font-normal text-base-content/60">(this host organization&apos;s active sites)</span>
          </label>
          <select
            id="assign-site"
            name="siteId"
            defaultValue={view.siteId}
            required
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            {options.siteOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assign-supervisor" className="text-sm font-medium">
            Supervisor{" "}
            <span className="font-normal text-base-content/60">
              (active supervisors and managers at this organization)
            </span>
          </label>
          <select
            id="assign-supervisor"
            name="supervisorId"
            defaultValue={view.supervisorId ?? ""}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            <option value="">Not yet assigned</option>
            {options.supervisorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assign-coordinator" className="text-sm font-medium">
            Coordinator of record{" "}
            <span className="font-normal text-base-content/60">(Nova Operations staff)</span>
          </label>
          <select
            id="assign-coordinator"
            name="coordinatorUserId"
            defaultValue={view.coordinatorUserId ?? ""}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          >
            <option value="">Not yet assigned</option>
            {options.coordinatorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Work schedule</legend>
          {DAYS.map((day) => {
            const existing = scheduled.get(day);
            const enabled = enabledDays.has(day);
            return (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <label className="flex w-32 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`day-${day}`}
                    checked={enabled}
                    onChange={(event) => {
                      setEnabledDays((previous) => {
                        const next = new Set(previous);
                        if (event.target.checked) next.add(day);
                        else next.delete(day);
                        return next;
                      });
                    }}
                  />
                  {DAY_LABELS[day]}
                </label>
                {enabled ? (
                  <>
                    <label className="flex items-center gap-1 text-xs">
                      Start
                      <input
                        type="time"
                        name={`start-${day}`}
                        defaultValue={existing?.startTime ?? "09:00"}
                        required
                        className="rounded-md border border-base-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      End
                      <input
                        type="time"
                        name={`end-${day}`}
                        defaultValue={existing?.endTime ?? "13:00"}
                        required
                        className="rounded-md border border-base-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            );
          })}
          <div className="flex flex-col gap-1">
            <label htmlFor="assign-hours" className="text-sm font-medium">
              Weekly hours target
            </label>
            <input
              id="assign-hours"
              name="weeklyHoursTarget"
              type="text"
              inputMode="decimal"
              defaultValue={view.structuredSchedule?.weeklyHoursTarget ?? ""}
              placeholder="e.g. 20 or 20.5"
              className="w-40 rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        {saveState.status === "error" && saveState.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {saveState.formError}
          </p>
        ) : null}
        {saveState.status === "saved" ? (
          <p role="status" className="rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
            Package saved.
          </p>
        ) : null}

        <Button type="submit" disabled={savePending} className="w-fit">
          {savePending ? "Saving…" : "Save Package"}
        </Button>
      </form>

      <form action={proposeFormAction} className="flex flex-col gap-2 border-t border-base-300 pt-4">
        <h3 className="text-sm font-semibold">Send for shelter review</h3>
        <p id="propose-package-hint" className="max-w-prose text-sm text-base-content/70">
          {ready
            ? "Proposing sends the site, supervisor, and schedule package to the Shelter Manager for review."
            : `Complete these first: ${view.packageMissing.join("; ")}.`}
        </p>
        {proposeState.status === "error" && proposeState.formError ? (
          <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {proposeState.formError}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={!ready || proposePending}
          aria-describedby="propose-package-hint"
          className="w-fit"
        >
          {proposePending ? "Proposing…" : "Propose to Shelter"}
        </Button>
      </form>
    </div>
  );
}

export function assignmentTab(): WorkspaceTab {
  return "schedule";
}
