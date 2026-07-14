import Link from "next/link";

import { ShelterApprovalCard } from "@/features/matching/proposed-placement-card";
import { getAuthContext } from "@/server/auth/context";
import { listShelterApprovals } from "@/server/services/matching-service";
import { listShelterPackageReviews } from "@/server/services/placement-service";
import { countShelterTimesheetsAwaitingReview } from "@/server/services/timesheet-service";

export const metadata = { title: "Shelter Dashboard" };

/**
 * Shelter dashboard (Stories 1.7/4.4/6.5). Placement approvals list
 * proposed matches for THIS shelter's organization only (resource scope
 * = hostOrganizationId; Drafts never appear); the timesheets card counts
 * submitted weeks awaiting review (wireframes-layouts.md).
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
      <h1 className="text-2xl font-bold tracking-tight">Shelter workspace</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Placement approvals</h2>
        {approvals.length === 0 ? (
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No proposed placements are waiting on your review right now. New
            proposals from Project Nova appear here.
          </p>
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
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No placement packages are waiting on your review. When Nova proposes
            a site, supervisor, and schedule, it appears here.
          </p>
        ) : (
          <ul aria-label="Placement package reviews" className="flex max-w-2xl flex-col gap-2">
            {packageReviews.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/shelter/placements/${row.id}`}
                  className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
                >
                  <span className="text-sm font-medium">
                    Review package: {row.participantName}
                  </span>
                  <span className="text-xs text-base-content/60">
                    {row.placementNumber} · {row.siteName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Timesheets awaiting review</h2>
        {timesheetsAwaiting === null || timesheetsAwaiting === 0 ? (
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No submitted timesheets are waiting on your review.
          </p>
        ) : (
          <Link
            href="/shelter/timesheets"
            className="flex max-w-2xl flex-col gap-1 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
          >
            <span className="text-sm font-medium">
              {timesheetsAwaiting}{" "}
              {timesheetsAwaiting === 1 ? "timesheet" : "timesheets"} awaiting
              review
            </span>
            <span className="text-xs text-base-content/60">
              Open the Timesheets queue
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
