"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DecisionFormState } from "@/features/review/actions";

/**
 * Interview Appointment + outcome form (Story 2.9;
 * docs/ux/component-guidelines.md). Scheduling uses a standard date/time
 * input (never drag-and-drop-only); rescheduling preserves prior times as
 * history. "Scheduled" and "outcome recorded" are visually and semantically
 * distinct. Notes and the recommendation are internal-only — the applicant
 * sees date/time/format through their journey (2.6). Do Not Advance invokes
 * the shared rejection (2.11).
 */

export interface InterviewSummary {
  id: string;
  scheduledAtLabel: string;
  formatLabel: string;
  interviewerName: string;
  outcomeLabel: string | null;
  notes: string | null;
  isCurrent: boolean;
}

export function InterviewPanel({
  status,
  interviews,
  canSchedule,
  canRecord,
  scheduleAction,
  recordAction,
}: {
  status: string;
  interviews: InterviewSummary[];
  canSchedule: boolean;
  canRecord: boolean;
  scheduleAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  recordAction: (prev: DecisionFormState, formData: FormData) => Promise<DecisionFormState>;
  }) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [scheduleState, scheduleFormAction, schedulePending] = useActionState(
    scheduleAction,
    { status: "idle" },
  );
  const [recordState, recordFormAction, recordPending] = useActionState(recordAction, {
    status: "idle",
  });

  const current = interviews.find((i) => i.isCurrent) ?? null;
  const history = interviews.filter((i) => !i.isCurrent);
  const inPhase = status === "INTERVIEW";

  if (!inPhase && interviews.length === 0) {
    return (
      <p className="max-w-prose text-sm text-base-content/70">
        No interview has been scheduled for this application.
      </p>
    );
  }

  return (
    <div className="flex max-w-prose flex-col gap-6">
      {current ? (
        <div className="rounded-lg border border-base-300 bg-base-100 p-5">
          <p className="text-sm font-medium text-base-content/70">
            {current.outcomeLabel ? "Interview — outcome recorded" : "Scheduled interview"}
          </p>
          <p className="mt-1 text-base font-semibold">
            {current.scheduledAtLabel} · {current.formatLabel}
          </p>
          <p className="mt-1 text-sm text-base-content/70">
            Interviewer: {current.interviewerName}
          </p>
          {current.outcomeLabel ? (
            <p className="mt-2 text-sm font-medium">Outcome: {current.outcomeLabel}</p>
          ) : null}
          {current.notes ? (
            <div className="mt-3 border-t border-base-300 pt-3">
              <p className="text-sm font-medium text-base-content/70">
                Internal notes (never shown to the applicant or shelters)
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {current.notes}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {inPhase && canSchedule && (!current || rescheduling) ? (
        <form action={scheduleFormAction} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            {current ? "Reschedule interview" : "Schedule interview"}
          </h3>
          {current ? (
            <p className="text-sm text-base-content/60">
              The current time stays in history — nothing is overwritten.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="interview-when" className="text-sm font-medium">
                Date and time
              </label>
              <input
                id="interview-when"
                type="datetime-local"
                name="scheduledAt"
                required
                className="rounded-md border border-base-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="interview-format" className="text-sm font-medium">
                Format
              </label>
              <select
                id="interview-format"
                name="format"
                required
                className="rounded-md border border-base-300 px-3 py-2 text-sm"
              >
                <option value="IN_PERSON">In person</option>
                <option value="VIRTUAL">Virtual</option>
              </select>
            </div>
            <Button type="submit" disabled={schedulePending}>
              {schedulePending
                ? "Scheduling…"
                : current
                  ? "Reschedule Interview"
                  : "Schedule Interview"}
            </Button>
            {current ? (
              <button
                type="button"
                onClick={() => setRescheduling(false)}
                className="text-sm font-medium underline underline-offset-2"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {scheduleState.status === "error" && scheduleState.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {scheduleState.formError}
            </p>
          ) : null}
        </form>
      ) : null}

      {inPhase && canSchedule && current && !rescheduling && !current.outcomeLabel ? (
        <button
          type="button"
          onClick={() => setRescheduling(true)}
          className="w-fit text-sm font-medium underline underline-offset-2"
        >
          Reschedule…
        </button>
      ) : null}

      {inPhase && canRecord && current && !current.outcomeLabel ? (
        <form action={recordFormAction} className="flex flex-col gap-4 border-t border-base-300 pt-5">
          <h3 className="text-sm font-semibold">Record interview outcome</h3>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Outcome</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="outcome"
                value="ADVANCE"
                className="mt-0.5"
                onChange={() => setOutcome("ADVANCE")}
              />
              Advance — moves to background review
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="outcome"
                value="DO_NOT_ADVANCE"
                className="mt-0.5"
                onChange={() => setOutcome("DO_NOT_ADVANCE")}
              />
              Do not advance — invokes the shared rejection (the applicant may reapply
              30 days after the decision)
            </label>
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="interview-notes" className="text-sm font-medium">
              Internal notes
            </label>
            <p className="text-sm text-base-content/60">
              Never shown to the applicant or shelters.
            </p>
            <textarea
              id="interview-notes"
              name="notes"
              rows={3}
              required
              className="rounded-md border border-base-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I&apos;m ready to record this outcome — Do not advance is final.
          </label>
          {recordState.status === "error" && recordState.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {recordState.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={!outcome || !confirmed || recordPending} className="w-fit">
            {recordPending ? "Recording…" : "Record Interview Outcome"}
          </Button>
        </form>
      ) : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Earlier scheduled times</h3>
          <ul className="flex flex-col gap-1.5">
            {history.map((interview) => (
              <li key={interview.id} className="text-sm text-base-content/70">
                {interview.scheduledAtLabel} · {interview.formatLabel} — rescheduled
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
