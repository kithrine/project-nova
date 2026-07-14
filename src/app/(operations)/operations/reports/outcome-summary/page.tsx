import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { OutcomeSummaryReport } from "@/features/reports/outcome-summary";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { getOutcomeSummary } from "@/server/services/reporting-service";

export const metadata = { title: "Outcome summary" };

const BASE_PATH = "/operations/reports/outcome-summary";

/** Outcome summary (Story 7.4) — aggregate program impact, Nova scope only. */
export default async function OutcomeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  const filters = await searchParams;
  let view;
  try {
    view = await getOutcomeSummary(ctx, filters);
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
        <h1 className="text-2xl font-bold tracking-tight">Outcome summary</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          How placements have ended and what participants have earned — aggregate
          counts for program impact reporting.
        </p>
      </header>

      <OutcomeSummaryReport view={view} basePath={BASE_PATH} />
    </section>
  );
}
