import { LifecycleTimeline } from "@/features/placement/lifecycle-timeline";
import { PackageReviewPanel } from "@/features/placement/package-review-panel";
import { WorkspaceTabNav } from "@/features/placement/workspace-tab-nav";
import { WorkspaceTabContent } from "@/features/placement/workspace-tabs";
import {
  WORKSPACE_TAB_LABELS,
  type PlacementWorkspaceView,
  type WorkspaceTab,
} from "@/server/services/placement-service";

/**
 * The placement workspace shell (Story 5.1;
 * docs/ux/wireframes-layouts.md): header, lifecycle timeline, the
 * blockers-and-actions region later stories populate (5.5/5.6–5.8), and
 * the role-shaped tab strip. Rendered identically for Nova and Shelter
 * viewers — the difference lives entirely in the server-shaped view
 * model, never in client-side hiding.
 */
export function PlacementWorkspace({
  view,
  activeTab,
  basePath,
}: {
  view: PlacementWorkspaceView;
  activeTab: WorkspaceTab;
  basePath: string;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-base-content/60">Placement {view.placementNumber}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {view.participantName} at {view.organizationName}
        </h1>
        <p className="text-sm text-base-content/70">
          {view.siteName}
          {view.siteLocation ? ` — ${view.siteLocation}` : ""} · Stage:{" "}
          <span className="font-medium">{view.statusLabel}</span>
        </p>
      </header>

      <LifecycleTimeline stages={view.timeline} />

      {/* Blockers-and-actions region: 5.5 renders the blocker list here;
          5.6–5.8 add lifecycle actions. Terminal placements get history
          only — no reopening control ever renders (AC4). */}
      {view.isTerminal ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          This placement is {view.statusLabel.toLowerCase()} — a final state. The
          record below is historical.
        </p>
      ) : null}

      {/* The shelter's outstanding change-request note (5.2): visible to
          the coordinator while the package is back in Draft. */}
      {view.viewer === "NOVA" && view.status === "DRAFT" && view.shelterReviewNote ? (
        <div className="flex max-w-prose flex-col gap-1 rounded-md border border-warning/40 bg-warning/5 px-4 py-3">
          <h2 className="text-sm font-semibold">The shelter requested changes</h2>
          <p className="text-sm text-base-content/80">{view.shelterReviewNote}</p>
          <p className="text-xs text-base-content/60">
            Adjust the package on the Schedule tab, then propose it again.
          </p>
        </div>
      ) : null}

      {view.status === "SHELTER_REVIEW" && view.viewer === "NOVA" ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          The package is with the Shelter Manager for review.
        </p>
      ) : null}

      {view.viewerCanApprovePackage ? (
        <PackageReviewPanel placementId={view.id} />
      ) : null}

      <div className="flex flex-col gap-4">
        <WorkspaceTabNav
          tabs={view.tabs}
          labels={WORKSPACE_TAB_LABELS}
          activeTab={activeTab}
          basePath={basePath}
        />
        <div role="tabpanel" aria-label={WORKSPACE_TAB_LABELS[activeTab]}>
          <WorkspaceTabContent tab={activeTab} view={view} />
        </div>
      </div>
    </section>
  );
}

/** Resolve the ?tab= query against the viewer's role-shaped tab list. */
export function resolveTab(
  view: PlacementWorkspaceView,
  requested: string | undefined,
): WorkspaceTab {
  return view.tabs.includes(requested as WorkspaceTab)
    ? (requested as WorkspaceTab)
    : "overview";
}
