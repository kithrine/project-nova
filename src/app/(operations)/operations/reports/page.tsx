import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";

export const metadata = { title: "Reports" };

/**
 * Operations → Reports (Story 7.1; information-architecture.md): the
 * index of read-only pilot reports. Entries whose stories are not built
 * yet render as disabled items (the Disabled screen state), exactly like
 * the navigation model treats future pages.
 */
const REPORTS: ReadonlyArray<{
  title: string;
  description: string;
  href: string;
  available: boolean;
}> = [
  {
    title: "Active placement summary",
    description:
      "Every in-progress placement — participant, host, site, supervisor, coordinator, stage, and start date.",
    href: "/operations/reports/active-placements",
    available: true,
  },
  {
    title: "Approved hours by funding source",
    description:
      "Finalized work hours rolled up by each placement's funding source — provisional pilot format (ADR-020).",
    href: "/operations/reports/hours-by-funding",
    available: true,
  },
  {
    title: "Shelter roster",
    description:
      "Participating shelters with sites, capacity, active placements, and staff contacts.",
    href: "/operations/reports/shelter-roster",
    available: true,
  },
  {
    title: "Outcome summary",
    description:
      "Aggregate program impact — how placements ended and credentials participants earned.",
    href: "/operations/reports/outcome-summary",
    available: true,
  },
  {
    title: "Exports",
    description:
      "Named CSV exports with fixed field sets; every download is audited (restricted).",
    href: "/operations/reports/exports",
    available: true,
  },
];

export default async function ReportsPage() {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "reporting.view")) {
    return <PermissionDenied />;
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Read-only views over the pilot's placements, hours, and partners."
      />

      <ul aria-label="Available reports" className="flex max-w-2xl flex-col gap-2">
        {REPORTS.map((report) => (
          <li
            key={report.href}
            {...(report.available ? {} : { "aria-disabled": true })}
            className={`flex flex-col gap-1 rounded-md border border-base-300 px-4 py-3 ${
              report.available ? "bg-base-100" : "bg-base-200/40 opacity-70"
            }`}
          >
            {report.available ? (
              <Link
                href={report.href}
                className="text-sm font-medium underline-offset-2 hover:underline"
              >
                {report.title}
              </Link>
            ) : (
              <p className="text-sm font-medium">
                {report.title}
                <span className="ml-2 text-xs font-normal text-base-content/60">
                  Coming soon
                </span>
              </p>
            )}
            <p className="text-xs text-base-content/60">{report.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
