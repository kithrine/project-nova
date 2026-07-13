import { AssignmentForm } from "@/features/placement/assignment-form";
import { CaseNotesTab } from "@/features/placement/case-notes-tab";
import { EvaluationsTab } from "@/features/placement/evaluations-tab";
import { FundingTab } from "@/features/placement/funding-tab";
import { IncidentsTab } from "@/features/placement/incidents-tab";
import { EVALUATION_AREAS, EVALUATION_RATINGS } from "@/server/domain/evaluation";
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from "@/server/domain/incident";
import type {
  PlacementWorkspaceView,
  WorkspaceTab,
} from "@/server/services/placement-service";

/**
 * Tab content for the placement workspace (Story 5.1). Overview and
 * History read real data; the rest render honest empty states until
 * their owning stories land (5.2 schedule, 5.3 funding, 5.4 onboarding
 * feeds, 5.9–5.11, Epic 6 hours). Content only ever renders for a tab
 * present in the role-shaped view model.
 */

function EmptyTab({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
      {children}
    </p>
  );
}

function OverviewField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">
        {label}
      </dt>
      <dd className="text-sm">{value ?? "Not yet assigned"}</dd>
    </div>
  );
}

export function WorkspaceTabContent({
  tab,
  view,
}: {
  tab: WorkspaceTab;
  view: PlacementWorkspaceView;
}) {
  switch (tab) {
    case "overview":
      return (
        <dl className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Participant" value={view.participantName} />
          <OverviewField label="Host organization" value={view.organizationName} />
          <OverviewField
            label="Site"
            value={`${view.siteName}${view.siteLocation ? ` — ${view.siteLocation}` : ""}`}
          />
          <OverviewField label="Supervisor" value={view.supervisorName} />
          <OverviewField label="Coordinator" value={view.coordinatorName} />
          <OverviewField label="Schedule" value={view.scheduleSummary} />
          <OverviewField
            label="Planned dates"
            value={
              view.startDateLabel
                ? `${view.startDateLabel}${view.endDateLabel ? ` – ${view.endDateLabel}` : ""}`
                : null
            }
          />
          <OverviewField label="Funding" value={view.fundingSummary} />
          <OverviewField label="Lifecycle stage" value={view.statusLabel} />
          {view.outcome ? (
            <OverviewField
              label="Employment outcome"
              value={`Hired by ${view.outcome.employerName} on ${view.outcome.hiredOnLabel}${
                view.outcome.jobTitle ? ` — ${view.outcome.jobTitle}` : ""
              }`}
            />
          ) : null}
        </dl>
      );
    case "schedule":
      return (
        <div className="flex flex-col gap-4">
          {view.structuredSchedule ? (
            <div className="flex max-w-prose flex-col gap-2">
              <h3 className="text-sm font-semibold">Working schedule</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {view.structuredSchedule.days.map((entry) => (
                  <li key={entry.day} className="flex gap-2">
                    <span className="w-28 font-medium">{entry.dayLabel}</span>
                    <span className="text-base-content/80">
                      {entry.startTime}–{entry.endTime}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-base-content/70">
                Weekly hours target: {view.structuredSchedule.weeklyHoursTarget}
              </p>
            </div>
          ) : view.assignmentOptions === null ? (
            <div className="flex max-w-prose flex-col gap-2">
              {view.scheduleSummary ? (
                <p className="text-sm">
                  Candidate schedule from the match: {view.scheduleSummary}
                </p>
              ) : null}
              <EmptyTab>
                The working schedule is set while the placement is prepared for
                shelter review.
              </EmptyTab>
            </div>
          ) : null}
          {view.assignmentOptions ? <AssignmentForm view={view} /> : null}
        </div>
      );
    case "hours":
      return (
        <EmptyTab>
          Hours summaries and timesheets arrive with Epic 6. This tab will show
          a read-only summary with a link into the participant&apos;s timesheets.
        </EmptyTab>
      );
    case "evaluations":
      return view.evaluations ? (
        <EvaluationsTab
          placementId={view.id}
          evaluations={view.evaluations}
          catalog={{ areas: EVALUATION_AREAS, ratings: EVALUATION_RATINGS }}
        />
      ) : null;
    case "incidents":
      return view.incidents ? (
        <IncidentsTab
          placementId={view.id}
          incidents={view.incidents}
          catalog={{
            categories: INCIDENT_CATEGORIES,
            severities: INCIDENT_SEVERITIES,
          }}
        />
      ) : null;
    case "caseNotes":
      // The tab only exists in Nova view models carrying the notes; the
      // guard is a type-narrowing safety net, never a hiding mechanism.
      return view.caseNotes ? (
        <CaseNotesTab placementId={view.id} caseNotes={view.caseNotes} />
      ) : null;
    case "documents":
      return (
        <EmptyTab>
          No placement documents yet. Uploads reuse the document capability
          from the application workflow.
        </EmptyTab>
      );
    case "funding":
      return <FundingTab placementId={view.id} funding={view.funding} />;
    case "history":
      return view.history.length === 0 ? (
        <EmptyTab>No lifecycle events recorded yet.</EmptyTab>
      ) : (
        <ol className="flex max-w-2xl flex-col gap-2">
          {view.history.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-0.5 rounded-md border border-base-300 bg-base-100 px-4 py-2.5"
            >
              <p className="text-sm">
                {entry.fromLabel ? `${entry.fromLabel} → ` : "Created as "}
                <span className="font-medium">{entry.toLabel}</span>
              </p>
              <p className="text-xs text-base-content/60">
                {entry.atLabel} · {entry.actorName}
              </p>
              {/* Ops-internal record (5.7 pause reasons, 5.2 change-request
                  archives) — the service nulls it for shelter viewers. */}
              {entry.detail ? (
                <p className="text-xs text-base-content/70">{entry.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      );
  }
}
