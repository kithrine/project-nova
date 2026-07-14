import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getAuthContext } from "@/server/auth/context";
import { AuthorizationError } from "@/server/errors/app-error";
import { listShelterTimesheetQueue } from "@/server/services/timesheet-service";

export const metadata = { title: "Timesheets" };

/**
 * The shelter Timesheets queue (Story 6.5; information-architecture.md):
 * submitted weeks awaiting review at the member's organization, oldest
 * first. Each row opens the Timesheet Review Card.
 */
export default async function ShelterTimesheetsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  let rows;
  try {
    rows = await listShelterTimesheetQueue(ctx);
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          Submitted weeks awaiting review, oldest first.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          Nothing is waiting for review.
        </p>
      ) : (
        <ul aria-label="Timesheets awaiting review" className="flex max-w-2xl flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.timesheetId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium">
                  {row.participantName} — {row.weekLabel}
                </p>
                <p className="text-xs text-base-content/60">
                  {row.placementNumber} · {row.totalHours} hours · submitted{" "}
                  {row.submittedAtLabel}
                </p>
              </div>
              <Link
                href={`/shelter/timesheets/${row.timesheetId}`}
                className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
              >
                Review timesheet: {row.participantName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
