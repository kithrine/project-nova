import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { Badge } from "@/components/ui/badge";
import { DateSquare } from "@/components/ui/date-square";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission, hasNovaScope } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import {
  listApplicationsForOperations,
  OPERATIONS_STATUS_LABELS,
  QUEUE_VISIBLE_STATUSES,
  resolveQueueFilter,
} from "@/server/services/application-review-service";

export const metadata = { title: "Applications" };

/**
 * Applications queue (Story 2.7, AC1). Nova-scoped via application.view;
 * SUBMITTED and in-review applications surface first, oldest submission
 * first within each phase. Filters are links (server-rendered — the whole
 * queue stays out of unauthorized payloads). Dense, desktop-optimized
 * table on the mobile-first baseline (docs/ux/ux-spec.md).
 */
export default async function ApplicationsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "application.view") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const filter = resolveQueueFilter((await searchParams).status);
  const entries = await listApplicationsForOperations(ctx, filter);

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: "/operations/applications", active: filter === "all" },
    ...QUEUE_VISIBLE_STATUSES.map((status) => ({
      label: OPERATIONS_STATUS_LABELS[status],
      href: `/operations/applications?status=${status}`,
      active: filter === status,
    })),
  ];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Submitted and in-review applications first, longest-waiting at the top. Drafts are never shown — an application appears here once its applicant submits it."
      />

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={[
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              item.active
                ? "border-primary bg-primary text-primary-content"
                : "border-base-300 text-base-content/80 hover:border-base-content/40",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-6 text-sm text-base-content/70">
          No applications here yet. New submissions appear the moment an applicant
          submits.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-md border border-base-300"
          tabIndex={0}
          role="region"
          aria-label="Applications queue table"
        >
          <table className="min-w-full text-sm">
            {/* Teal header band (docs/ux/component-guidelines.md data-table recipe). */}
            <thead className="bg-primary text-left text-primary-content">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Application</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Applicant</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-base-300 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/operations/applications/${entry.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {entry.applicationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{entry.applicantName}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={entry.statusTone}>{entry.statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-base-content/70">
                    {entry.submittedAtParts ? (
                      <span className="flex items-center gap-2">
                        <DateSquare parts={entry.submittedAtParts} />
                        <span aria-hidden="true" className="whitespace-nowrap text-xs">
                          {entry.submittedAtParts.year}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
