import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { HoursByFundingReport } from "@/features/reports/hours-by-funding";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { getApprovedHoursByFundingSource } from "@/server/services/reporting-service";

export const metadata = { title: "Approved hours by funding source" };

const BASE_PATH = "/operations/reports/hours-by-funding";

/**
 * Approved hours by funding source (Story 7.2; ADR-020 provisional
 * format). Nova scope only — the service denies org-scoped viewers even
 * though they hold reporting.view for the organization-scoped reports.
 */
export default async function HoursByFundingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  const filters = await searchParams;
  let view;
  try {
    view = await getApprovedHoursByFundingSource(ctx, filters);
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
        <h1 className="text-2xl font-bold tracking-tight">
          Approved hours by funding source
        </h1>
        <p className="max-w-prose text-sm text-base-content/70">
          Finalized (locked) work hours are the reimbursement-safe basis; hours that
          are approved but not yet finalized are shown separately and never blended.
        </p>
      </header>

      <HoursByFundingReport view={view} basePath={BASE_PATH} />
    </section>
  );
}
