import { requireNovaScope, requirePermission } from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import { toCsv } from "@/server/domain/csv";
import { NotFoundError } from "@/server/errors/app-error";
import {
  getActivePlacementSummary,
  getApprovedHoursByFundingSource,
  getOutcomeSummary,
  getShelterRoster,
} from "@/server/services/reporting-service";

/**
 * Named exports (Story 7.5; ADR-021). Each export is a NAMED artifact
 * with a fixed field allow-list — the columns below are the complete,
 * closed set a funder ever receives, built from the role-shaped report
 * views (whose queries already exclude restricted fields, 7.1 AC5).
 * Exports are EPHEMERAL: generated on demand, streamed, never stored;
 * the audit event written per run is the durable record (7.6 reviews
 * it). Restricted contents — background details, case notes, government
 * identifiers, incident narratives — cannot appear because no export
 * definition has a column for them and the source views never carry
 * them.
 */

export type ExportKey =
  | "active-placements"
  | "hours-by-funding"
  | "shelter-roster"
  | "outcome-summary";

export interface ExportDefinition {
  key: ExportKey;
  name: string;
  description: string;
  /** The complete, fixed field allow-list (ADR-021). */
  columns: readonly string[];
  /** ADR-020's provisional flag, carried onto the hours export. */
  provisional: boolean;
}

export const EXPORT_DEFINITIONS: readonly ExportDefinition[] = [
  {
    key: "active-placements",
    name: "Active placement summary",
    description:
      "Every in-progress placement with host, site, staff, stage, and start date.",
    columns: [
      "Placement number",
      "Participant",
      "Host organization",
      "Site",
      "Supervisor",
      "Coordinator",
      "Stage",
      "Start date",
    ],
    provisional: false,
  },
  {
    key: "hours-by-funding",
    name: "Approved hours by funding source",
    description:
      "Finalized and approved-but-unlocked hours per funding source for a period — provisional pilot format (ADR-020).",
    columns: [
      "Funding source",
      "Kind",
      "Award code",
      "Finalized hours",
      "Approved not finalized",
      "Placements",
      "Period start",
      "Period end",
    ],
    provisional: true,
  },
  {
    key: "shelter-roster",
    name: "Shelter roster",
    description:
      "Participating shelters and sites with capacity, active placements, and staff.",
    columns: [
      "Organization",
      "Site",
      "Site capacity",
      "Active placements",
      "Managers",
      "Supervisors",
    ],
    provisional: false,
  },
  {
    key: "outcome-summary",
    name: "Outcome summary",
    description:
      "Aggregate counts of placement outcomes and credentials earned for a period.",
    columns: ["Measure", "Count", "Period start", "Period end"],
    provisional: false,
  },
] as const;

export interface ExportResult {
  fileName: string;
  csv: string;
  definition: ExportDefinition;
}

/**
 * Run a named export: authorize, build the allow-listed rows from the
 * role-shaped report view, render CSV, and write the audit event that
 * is the export's durable record — actor, export name, scope, timestamp
 * (AC2). Nothing is persisted besides that event. Denied callers never
 * produce a file OR an audit event (the authorization throw precedes
 * both, AC4).
 */
export async function runNamedExport(
  ctx: AuthContext,
  exportKey: string,
  filters: { from?: string; to?: string } = {},
): Promise<ExportResult> {
  requirePermission(ctx, "report.export");
  requireNovaScope(ctx);

  const definition = EXPORT_DEFINITIONS.find((entry) => entry.key === exportKey);
  if (!definition) throw new NotFoundError();

  let rows: Array<Array<string | number | null>>;
  let scopeDetail = "Nova-wide";

  switch (definition.key) {
    case "active-placements": {
      const view = await getActivePlacementSummary(ctx);
      rows = view.rows.map((row) => [
        row.placementNumber,
        row.participantName,
        row.organizationName,
        row.siteName,
        row.supervisorName,
        row.coordinatorName,
        row.stageLabel,
        row.startDateIso,
      ]);
      break;
    }
    case "hours-by-funding": {
      const view = await getApprovedHoursByFundingSource(ctx, filters);
      rows = view.groups.map((group) => [
        group.name,
        group.kindLabel,
        group.code,
        group.lockedHours,
        group.approvedHours,
        group.placementCount,
        view.range.fromIso,
        view.range.toIso,
      ]);
      scopeDetail = `${view.range.fromIso} to ${view.range.toIso}`;
      break;
    }
    case "shelter-roster": {
      const view = await getShelterRoster(ctx);
      rows = view.organizations.flatMap((organization) => {
        const managers = organization.managers.map((m) => m.name).join("; ");
        const supervisors = organization.supervisorNames.join("; ");
        if (organization.sites.length === 0) {
          return [[organization.name, null, 0, 0, managers, supervisors]];
        }
        return organization.sites.map((site) => [
          organization.name,
          site.name,
          site.capacity,
          site.activePlacementCount,
          managers,
          supervisors,
        ]);
      });
      break;
    }
    case "outcome-summary": {
      const view = await getOutcomeSummary(ctx, filters);
      const fromIso = view.range?.fromIso ?? null;
      const toIso = view.range?.toIso ?? null;
      rows = [
        ...view.outcomes.map((outcome) => [outcome.label, outcome.count, fromIso, toIso]),
        ["Credentials earned", view.certificationsEarned, fromIso, toIso],
      ];
      scopeDetail = view.range
        ? `${view.range.fromIso} to ${view.range.toIso}`
        : "program to date";
      break;
    }
  }

  const csv = toCsv(definition.columns, rows);

  // The durable record of this export (AC2; reviewed by Story 7.6). The
  // detail carries the export name and period only — never row contents.
  await prisma.auditEvent.create({
    data: {
      actorUserId: ctx.userId,
      action: "report.export",
      subjectType: "Export",
      subjectId: definition.key,
      detail: `${definition.name} (${scopeDetail})`,
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    fileName: `nova-${definition.key}-${stamp}.csv`,
    csv,
    definition,
  };
}
