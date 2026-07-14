import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { ActivePlacementSummary } from "@/features/reports/active-placement-summary";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { getActivePlacementSummary } from "@/server/services/reporting-service";

export const metadata = { title: "Active placement summary" };

const BASE_PATH = "/operations/reports/active-placements";

/**
 * The Active Placement Summary report (Story 7.1): in-progress placements
 * in the viewer's scope, filterable by host organization, lifecycle
 * stage, and coordinator, with a live result count. Read-only — the
 * ReportingService applies scope and excludes restricted fields at the
 * query layer.
 */
export default async function ActivePlacementsReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizationId?: string;
    stage?: string;
    coordinatorUserId?: string;
    sort?: string;
    direction?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  const filters = await searchParams;
  let view;
  try {
    view = await getActivePlacementSummary(ctx, filters);
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs">
          <Link href="/operations/reports" className="underline underline-offset-2">
            Reports
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Active placement summary</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          Placements currently in progress — onboarding, active, or paused. Terminal
          placements are excluded.
        </p>
      </header>

      <ActivePlacementSummary view={view} basePath={BASE_PATH} />
    </section>
  );
}
