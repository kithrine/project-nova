import Link from "next/link";

import { NavIcon } from "@/components/layout/nav-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import {
  listUrgentBlockers,
  listUrgentIncidents,
} from "@/server/services/placement-service";

export const metadata = { title: "Operations Dashboard" };

/**
 * Operations dashboard (docs/ux/wireframes-layouts.md; brand pass
 * 2026-07-16). Story 5.5 added the Urgent blockers surface; Story 5.11
 * adds Urgent incidents — every open Serious/Emergency report, always
 * visible in-app since real-time messaging is V2. The stat row surfaces
 * the same permission-gated counts at a glance.
 */
export default async function OperationsDashboardPage() {
  const ctx = await getAuthContext();
  const canViewPlacements =
    ctx !== null && hasPermission(ctx, "placement.view") && hasNovaScope(ctx);
  const canReviewIncidents =
    ctx !== null && hasPermission(ctx, "incident.review") && hasNovaScope(ctx);
  const urgent = canViewPlacements && ctx ? await listUrgentBlockers(ctx) : [];
  const urgentIncidents = canReviewIncidents && ctx ? await listUrgentIncidents(ctx) : [];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Operations workspace"
        description="Everything urgent across the pilot — open incidents and blocked activations — with the queues one click away."
      />

      {canReviewIncidents || canViewPlacements ? (
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          {canReviewIncidents ? (
            <StatCard
              label="Urgent incidents"
              value={urgentIncidents.length}
              sublabel="Open Serious or Emergency reports"
              icon={<NavIcon name="alert" className="size-5" />}
              tone="error"
            />
          ) : null}
          {canViewPlacements ? (
            <StatCard
              label="Urgent blockers"
              value={urgent.length}
              sublabel="Placements blocked at activation"
              icon={<NavIcon name="briefcase" className="size-5" />}
              tone="warning"
            />
          ) : null}
        </div>
      ) : null}

      {canReviewIncidents ? (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-error"
            >
              <path d="M12 3 2.5 19.5h19L12 3Z" />
              <path d="M12 10v4" />
              <path d="M12 17.5v.5" />
            </svg>
            Urgent incidents
          </h2>
          {urgentIncidents.length === 0 ? (
            <Card variant="muted" className="max-w-prose text-sm text-base-content/70">
              No open Serious or Emergency incidents.
            </Card>
          ) : (
            <ul aria-label="Urgent incidents" className="flex max-w-3xl flex-col gap-2">
              {urgentIncidents.map((row) => (
                <li
                  key={row.incidentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-surface px-4 py-3 shadow-(--shadow-sm)"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Badge tone="error">{row.severityLabel}</Badge>
                      {row.categoryLabel} · {row.participantName}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {row.incidentNumber} · {row.placementNumber} · {row.statusLabel} ·
                      reported {row.reportedAtLabel}
                    </p>
                  </div>
                  <Link
                    href={`/operations/placements/records/${row.placementId}?tab=incidents`}
                    className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
                  >
                    Open incident: {row.incidentNumber}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {canViewPlacements ? (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-warning"
            >
              <path d="M12 3 2.5 19.5h19L12 3Z" />
              <path d="M12 10v4" />
              <path d="M12 17.5v.5" />
            </svg>
            Urgent blockers
          </h2>
          {urgent.length === 0 ? (
            <Card variant="muted" className="max-w-prose text-sm text-base-content/70">
              No placements are blocked at the activation gate. Placements in
              onboarding with unmet prerequisites appear here.
            </Card>
          ) : (
            <ul aria-label="Urgent blockers" className="flex max-w-3xl flex-col gap-2">
              {urgent.map((row) => (
                <li
                  key={row.placementId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-surface px-4 py-3 shadow-(--shadow-sm)"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Badge tone="warning">Blocked</Badge>
                      {row.participantName}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {row.placementNumber} · {row.siteName} · Open:{" "}
                      {row.openTitles.join("; ")}
                    </p>
                  </div>
                  <Link
                    href={`/operations/placements/records/${row.placementId}`}
                    className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
                  >
                    Open placement: {row.participantName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
