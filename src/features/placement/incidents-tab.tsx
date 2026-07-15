"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  addIncidentFollowUpAction,
  closeIncidentAction,
  startIncidentReviewAction,
  submitIncidentAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type {
  IncidentsTabView,
  IncidentView,
} from "@/server/services/placement-service";

/**
 * The Incidents tab (Story 5.11; docs/ops/incident-response.md). The
 * Incident Form carries a persistent, programmatically-prominent notice
 * that submission does not replace emergency services; Serious and
 * Emergency severities require an extra confirmation. Severity renders
 * as text + icon, never color alone. Shelter staff report and follow up
 * only; the review and closure controls render solely for Nova viewers
 * with incident.review.
 */

export interface IncidentFormCatalog {
  categories: readonly { key: string; label: string }[];
  severities: readonly { key: string; label: string }[];
}

const URGENT_KEYS = new Set(["SERIOUS", "EMERGENCY"]);

function SeverityBadge({
  severityKey,
  severityLabel,
}: {
  severityKey: string;
  severityLabel: string;
}) {
  const urgent = URGENT_KEYS.has(severityKey);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        urgent ? "border-warning/60 bg-warning/10" : "border-base-300 bg-base-200/60"
      }`}
    >
      {urgent ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 shrink-0 text-warning"
        >
          <path d="M12 3 2.5 19.5h19L12 3Z" />
          <path d="M12 10v4" />
          <path d="M12 17.5v.5" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-3.5 shrink-0 text-base-content/50"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
      {severityLabel}
    </span>
  );
}

function EmergencyNotice() {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-md border border-error/50 bg-error/5 px-3 py-2 text-sm"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-5 shrink-0 text-error"
      >
        <path d="M12 3 2.5 19.5h19L12 3Z" />
        <path d="M12 10v4" />
        <path d="M12 17.5v.5" />
      </svg>
      <strong>
        Submitting this form does not replace calling emergency services. If
        anyone is in danger, call 911 first — this record is documentation and
        notification only.
      </strong>
    </p>
  );
}

function FollowUpForm({ incidentId }: { incidentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: PlacementFormState, formData: FormData) => {
      const next = await addIncidentFollowUpAction(incidentId, prev, formData);
      if (next.status === "saved") formRef.current?.reset();
      return next;
    },
    { status: "idle" } as PlacementFormState,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`follow-up-${incidentId}`}>
        Add follow-up
      </label>
      <textarea
        id={`follow-up-${incidentId}`}
        name="body"
        rows={2}
        required
        placeholder="Add follow-up detail…"
        className="textarea textarea-bordered w-full"
      />
      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Add Follow-up"}
      </Button>
    </form>
  );
}

function ReviewControls({ incident }: { incident: IncidentView }) {
  const [closing, setClosing] = useState(false);
  const [reviewState, reviewAction, reviewPending] = useActionState(
    startIncidentReviewAction.bind(null, incident.id),
    { status: "idle" } as PlacementFormState,
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeIncidentAction.bind(null, incident.id),
    { status: "idle" } as PlacementFormState,
  );

  return (
    <div className="flex flex-col gap-2 border-t border-base-300 pt-2">
      {incident.statusKey === "OPEN" ? (
        <form action={reviewAction}>
          {reviewState.status === "error" && reviewState.formError ? (
            <p role="alert" className="mb-1 text-sm text-error">
              {reviewState.formError}
            </p>
          ) : null}
          <Button type="submit" size="sm" variant="secondary" disabled={reviewPending}>
            {reviewPending ? "Starting…" : "Start Review"}
          </Button>
        </form>
      ) : null}
      {closing ? (
        <form action={closeAction} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Outcome (required)
            <textarea
              name="outcome"
              rows={2}
              required
              className="textarea textarea-bordered w-full"
              placeholder="What was reviewed and decided"
            />
          </label>
          {closeState.status === "error" && closeState.formError ? (
            <p role="alert" className="text-sm text-error">
              {closeState.formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={closePending}>
              {closePending ? "Closing…" : "Yes, Close Incident"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setClosing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-fit"
          onClick={() => setClosing(true)}
        >
          Close Incident…
        </Button>
      )}
    </div>
  );
}

function IncidentCard({ incident }: { incident: IncidentView }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {incident.incidentNumber} · {incident.categoryLabel}
        </p>
        <SeverityBadge
          severityKey={incident.severityKey}
          severityLabel={incident.severityLabel}
        />
        <span className="text-xs font-medium text-base-content/70">
          {incident.statusLabel}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{incident.description}</p>
      {incident.restrictedDetail ? (
        <div className="flex flex-col gap-1 rounded-md border border-error/40 bg-error/5 px-3 py-2">
          <p className="text-xs font-semibold">
            Restricted narrative — access is audited
          </p>
          <p className="whitespace-pre-wrap text-sm">{incident.restrictedDetail}</p>
        </div>
      ) : null}
      <p className="text-xs text-base-content/60">
        Occurred {incident.occurredOnLabel} · reported by {incident.reportedByName} ·{" "}
        {incident.reportedAtLabel}
      </p>
      {incident.followUps.length > 0 ? (
        <ul aria-label="Follow-ups" className="flex flex-col gap-1 border-l-2 border-base-300 pl-3">
          {incident.followUps.map((followUp) => (
            <li key={followUp.id} className="flex flex-col gap-0.5">
              <p className="whitespace-pre-wrap text-sm">{followUp.body}</p>
              <p className="text-xs text-base-content/60">
                {followUp.authorName} · {followUp.atLabel}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {incident.closureOutcome ? (
        <p className="text-sm">
          <span className="text-base-content/70">Closed: </span>
          {incident.closureOutcome}
          <span className="text-xs text-base-content/60">
            {" "}
            — {incident.closedByName} · {incident.closedAtLabel}
          </span>
        </p>
      ) : null}
      {incident.viewerCanFollowUp ? <FollowUpForm incidentId={incident.id} /> : null}
      {incident.viewerCanReview ? <ReviewControls incident={incident} /> : null}
    </li>
  );
}

export function IncidentsTab({
  placementId,
  incidents,
  catalog,
}: {
  placementId: string;
  incidents: IncidentsTabView;
  catalog: IncidentFormCatalog;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [severity, setSeverity] = useState("");
  const [confirmedUrgent, setConfirmedUrgent] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: PlacementFormState, formData: FormData) => {
      const next = await submitIncidentAction(placementId, prev, formData);
      if (next.status === "saved") {
        formRef.current?.reset();
        setSeverity("");
        setConfirmedUrgent(false);
      }
      return next;
    },
    { status: "idle" } as PlacementFormState,
  );
  const urgentSelected = URGENT_KEYS.has(severity);

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      {incidents.viewerCanReport ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
        >
          <h2 className="text-sm font-semibold">Report an incident</h2>
          <EmergencyNotice />
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select
              name="category"
              required
              defaultValue=""
              className="select select-bordered w-full max-w-xs"
            >
              <option value="" disabled>
                Choose a category…
              </option>
              {catalog.categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">Severity</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {catalog.severities.map((entry) => (
                <label key={entry.key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="severity"
                    value={entry.key}
                    required
                    onChange={() => {
                      setSeverity(entry.key);
                      setConfirmedUrgent(false);
                    }}
                  />
                  {entry.label}
                </label>
              ))}
            </div>
          </fieldset>
          {urgentSelected ? (
            <label className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmedUrgent}
                onChange={(event) => setConfirmedUrgent(event.target.checked)}
              />
              This is a {severity === "EMERGENCY" ? "an Emergency" : "a Serious"}
              -severity report — it alerts Nova Operations immediately, and I
              understand it does not replace emergency services.
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            Date it occurred
            <input
              type="date"
              name="occurredOn"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="input input-bordered w-fit"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            What happened
            <textarea
              name="description"
              rows={3}
              required
              className="textarea textarea-bordered w-full"
              placeholder="Describe the incident factually"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Restricted narrative (optional — visible only to restricted reviewers)
            <textarea
              name="restrictedDetail"
              rows={2}
              className="textarea textarea-bordered w-full"
              placeholder="Sensitive specifics, if any"
            />
          </label>
          {state.status === "error" && state.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {state.formError}
            </p>
          ) : null}
          {state.status === "saved" ? (
            <p role="status" className="text-sm text-success">
              Incident reported.
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || (urgentSelected && !confirmedUrgent)}
            className="w-fit"
          >
            {pending ? "Reporting…" : "Report Incident"}
          </Button>
        </form>
      ) : null}

      {incidents.entries.length === 0 ? (
        <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No incidents reported. That&apos;s good news.
        </p>
      ) : (
        <ul aria-label="Incidents" className="flex flex-col gap-2">
          {incidents.entries.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </ul>
      )}
    </section>
  );
}
