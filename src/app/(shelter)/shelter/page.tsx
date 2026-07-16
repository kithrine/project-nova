import Link from "next/link";

import { NavIcon } from "@/components/layout/nav-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ShelterApprovalCard } from "@/features/matching/proposed-placement-card";
import { getAuthContext } from "@/server/auth/context";
import { listShelterApprovals } from "@/server/services/matching-service";
import { listShelterPackageReviews } from "@/server/services/placement-service";
import { countShelterTimesheetsAwaitingReview } from "@/server/services/timesheet-service";

export const metadata = { title: "Shelter Dashboard" };

/**
 * Shelter dashboard (Stories 1.7/4.4/6.5; brand pass 2026-07-16).
 * Placement approvals list proposed matches for THIS shelter's
 * organization only (resource scope = hostOrganizationId; Drafts never
 * appear); the stat row surfaces the same fetched counts at a glance.
 */
export default async function ShelterDashboardPage() {
  const ctx = await getAuthContext();
  let approvals: Awaited<ReturnType<typeof listShelterApprovals>> = [];
  let packageReviews: Awaited<ReturnType<typeof listShelterPackageReviews>> = [];
  let timesheetsAwaiting: number | null = null;
  if (ctx) {
    try {
      [approvals, packageReviews, timesheetsAwaiting] = await Promise.all([
        listShelterApprovals(ctx),
        listShelterPackageReviews(ctx),
        countShelterTimesheetsAwaitingReview(ctx),
      ]);
    } catch {
      // Not a shelter member (e.g. staff previewing) — show the empty shell.
      approvals = [];
      packageReviews = [];
      timesheetsAwaiting = null;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Shelter workspace"
        description="Approvals, package reviews, and timesheets for your organization — everything waiting on you, in one place."
      />

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Placement approvals"
          value={approvals.length}
          sublabel="Proposed matches to review"
          icon={<NavIcon name="users" className="size-5" />}
          tone="primary"
        />
        <StatCard
          label="Package reviews"
          value={packageReviews.length}
          sublabel="Site and schedule proposals"
          icon={<NavIcon name="briefcase" className="size-5" />}
          tone="accent"
        />
        <StatCard
          label="Timesheets awaiting"
          value={timesheetsAwaiting ?? 0}
          sublabel="Open the queue"
          href="/shelter/timesheets"
          icon={<NavIcon name="clock" className="size-5" />}
          tone="warning"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Placement approvals</h2>
        {approvals.length === 0 ? (
          <Card variant="muted" className="max-w-prose text-sm text-base-content/70">
            No proposed placements are waiting on your review right now. New
            proposals from Project Nova appear here.
          </Card>
        ) : (
          <ul aria-label="Placement approvals" className="flex max-w-2xl flex-col gap-2">
            {approvals.map((match) => (
              <ShelterApprovalCard key={match.id} match={match} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Placement package reviews</h2>
        {packageReviews.length === 0 ? (
          <Card variant="muted" className="max-w-prose text-sm text-base-content/70">
            No placement packages are waiting on your review. When Nova proposes
            a site, supervisor, and schedule, it appears here.
          </Card>
        ) : (
          <ul aria-label="Placement package reviews" className="flex max-w-2xl flex-col gap-2">
            {packageReviews.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/shelter/placements/${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium">
                      Review package: {row.participantName}
                    </span>
                    <span className="text-xs text-base-content/60">
                      {row.placementNumber} · {row.siteName}
                    </span>
                  </span>
                  <Badge tone="warning">Awaiting review</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timesheets awaiting review</h2>
        {timesheetsAwaiting === null || timesheetsAwaiting === 0 ? (
          <Card variant="muted" className="max-w-prose text-sm text-base-content/70">
            No submitted timesheets are waiting on your review.
          </Card>
        ) : (
          <Link
            href="/shelter/timesheets"
            className="flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">
                {timesheetsAwaiting}{" "}
                {timesheetsAwaiting === 1 ? "timesheet" : "timesheets"} awaiting
                review
              </span>
              <span className="text-xs text-base-content/60">
                Open the Timesheets queue
              </span>
            </span>
            <Badge tone="warning">Awaiting review</Badge>
          </Link>
        )}
      </div>
    </section>
  );
}
