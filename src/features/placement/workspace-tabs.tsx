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
        </dl>
      );
    case "schedule":
      return (
        <div className="flex max-w-prose flex-col gap-2">
          {view.scheduleSummary ? (
            <p className="text-sm">
              Candidate schedule from the match: {view.scheduleSummary}
            </p>
          ) : null}
          <EmptyTab>
            The structured schedule — days, times, and weekly hours — is set
            during site and supervisor assignment (Story 5.2).
          </EmptyTab>
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
      return (
        <EmptyTab>
          No evaluations yet. Shelter supervisors submit evaluations once the
          placement is active (Story 5.10).
        </EmptyTab>
      );
    case "incidents":
      return (
        <EmptyTab>
          No incidents reported. Incident reporting opens with Story 5.11 —
          submitting a report never replaces calling emergency services.
        </EmptyTab>
      );
    case "caseNotes":
      return (
        <EmptyTab>
          No case notes yet. Internal coordination notes arrive with Story 5.9
          and are never visible to shelters or participants.
        </EmptyTab>
      );
    case "documents":
      return (
        <EmptyTab>
          No placement documents yet. Uploads reuse the document capability
          from the application workflow.
        </EmptyTab>
      );
    case "funding":
      return (
        <div className="flex max-w-prose flex-col gap-2">
          {view.fundingSummary ? (
            <p className="text-sm">{view.fundingSummary} (carried from the match)</p>
          ) : null}
          <EmptyTab>
            Funding assignments — exactly one active at a time — arrive with
            Story 5.3.
          </EmptyTab>
        </div>
      );
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
            </li>
          ))}
        </ol>
      );
  }
}
