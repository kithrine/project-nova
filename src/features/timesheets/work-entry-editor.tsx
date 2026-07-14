"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  addWorkEntryAction,
  removeWorkEntryAction,
  updateWorkEntryAction,
  type TimesheetFormState,
} from "@/features/timesheets/actions";
import type { WeekDayView, WorkEntryView } from "@/server/services/timesheet-service";

/**
 * The week's entry editor (Story 6.2): per-day lists plus one accessible
 * add form — labeled date/time inputs, never a drag-only picker
 * (accessibility.md). Hours are display-only everywhere: the server
 * computes them (6.3) and the running total re-renders from server
 * truth after every save. Renders read-only when the timesheet isn't
 * participant-editable.
 */

function entryFields(days: WeekDayView[], defaults?: WorkEntryView & { dateIso: string }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Day
        <select
          name="workDate"
          required
          defaultValue={defaults?.dateIso ?? ""}
          className="select select-bordered w-full max-w-xs"
        >
          {defaults?.dateIso ? null : (
            <option value="" disabled>
              Choose a day…
            </option>
          )}
          {days.map((day) => (
            <option key={day.dateIso} value={day.dateIso}>
              {day.dayLabel}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Start time
          <input
            type="time"
            name="startTime"
            required
            defaultValue={defaults?.startTime}
            className="input input-bordered w-fit"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          End time
          <input
            type="time"
            name="endTime"
            required
            defaultValue={defaults?.endTime}
            className="input input-bordered w-fit"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Unpaid break (minutes)
          <input
            type="number"
            name="breakMinutes"
            min={0}
            step={1}
            defaultValue={defaults?.breakMinutes ?? 0}
            className="input input-bordered w-24"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        What you worked on (optional)
        <input
          type="text"
          name="note"
          defaultValue={defaults?.note ?? ""}
          className="input input-bordered w-full"
        />
      </label>
    </>
  );
}

function EntryRow({
  entry,
  dateIso,
  days,
  editable,
}: {
  entry: WorkEntryView;
  dateIso: string;
  days: WeekDayView[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    async (prev: TimesheetFormState, formData: FormData) => {
      const next = await updateWorkEntryAction(entry.id, prev, formData);
      if (next.status === "saved") setEditing(false);
      return next;
    },
    { status: "idle" } as TimesheetFormState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeWorkEntryAction.bind(null, entry.id),
    { status: "idle" } as TimesheetFormState,
  );

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2">
        <form action={editAction} className="flex flex-col gap-2">
          {entryFields(days, { ...entry, dateIso })}
          {editState.status === "error" && editState.formError ? (
            <p role="alert" className="text-sm text-error">
              {editState.formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={editPending}>
              {editPending ? "Saving…" : "Save Entry"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm tabular-nums">
          {entry.startTime}–{entry.endTime}
          {entry.breakMinutes > 0 ? ` · ${entry.breakMinutes} min break` : ""} ·{" "}
          <span className="font-medium">{entry.hours} hours</span>
        </p>
        {entry.note ? (
          <p className="text-xs text-base-content/70">{entry.note}</p>
        ) : null}
        {removeState.status === "error" && removeState.formError ? (
          <p role="alert" className="text-xs text-error">
            {removeState.formError}
          </p>
        ) : null}
      </div>
      {editable ? (
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <form action={removeAction}>
            <Button type="submit" size="sm" variant="secondary" disabled={removePending}>
              {removePending ? "Removing…" : "Remove"}
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

export function WorkEntryEditor({
  timesheetId,
  days,
  editable,
}: {
  timesheetId: string;
  days: WeekDayView[];
  editable: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: TimesheetFormState, formData: FormData) => {
      const next = await addWorkEntryAction(timesheetId, prev, formData);
      if (next.status === "saved") formRef.current?.reset();
      return next;
    },
    { status: "idle" } as TimesheetFormState,
  );
  const hasEntries = days.some((day) => day.entries.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {hasEntries ? (
        <div className="flex flex-col gap-2">
          {days
            .filter((day) => day.entries.length > 0)
            .map((day) => (
              <section key={day.dateIso} className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{day.dayLabel}</h3>
                <ul className="flex flex-col gap-1">
                  {day.entries.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      dateIso={day.dateIso}
                      days={days}
                      editable={editable}
                    />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : (
        <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          {editable
            ? "No hours recorded yet — add your first work day below."
            : "No hours were recorded for this week."}
        </p>
      )}

      {editable ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4"
        >
          <h3 className="text-sm font-semibold">Add a work day</h3>
          {entryFields(days)}
          {state.status === "error" && state.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {state.formError}
            </p>
          ) : null}
          {state.status === "saved" ? (
            <p role="status" className="text-sm text-success">
              Entry saved.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Add Entry"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
