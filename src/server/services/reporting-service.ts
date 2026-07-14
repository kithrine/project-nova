import { PlacementStatus } from "@/generated/prisma/client";
import { hasNovaScope, requirePermission } from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import {
  ACTIVE_PLACEMENT_STATUSES,
  PLACEMENT_STATUS_LABELS,
} from "@/server/domain/placement";

/**
 * ReportingService (Epic 7; api-service-design.md). Read-only report
 * queries over data earlier epics wrote. Every query applies the
 * viewer's scope itself — Nova Operations reads Nova-wide, shelter
 * viewers read only their own organizations — and restricted fields
 * (background details, case notes, government identifiers) are excluded
 * at the query layer by selecting only permitted columns, never merely
 * hidden in the UI (Story 7.1 AC5).
 */

export interface ReportFilterOption {
  value: string;
  label: string;
}

export type SummarySortKey = "participant" | "organization" | "stage" | "start";
export type SummarySortDirection = "asc" | "desc";

export interface ActivePlacementSummaryRow {
  placementId: string;
  placementNumber: string;
  participantName: string;
  organizationName: string;
  siteName: string;
  supervisorName: string | null;
  coordinatorName: string | null;
  stage: PlacementStatus;
  stageLabel: string;
  /** ISO date or null — placements can reach Onboarding before a start date. */
  startDateIso: string | null;
  startDateLabel: string | null;
}

export interface ActivePlacementSummaryFilters {
  organizationId?: string;
  stage?: string;
  coordinatorUserId?: string;
  sort?: string;
  direction?: string;
}

export interface AppliedSummaryFilters {
  organizationId: string | null;
  stage: PlacementStatus | null;
  coordinatorUserId: string | null;
  sort: SummarySortKey;
  direction: SummarySortDirection;
}

export interface ActivePlacementSummaryView {
  rows: ActivePlacementSummaryRow[];
  /** The live result count after filters (AC2). */
  count: number;
  organizationOptions: ReportFilterOption[];
  stageOptions: ReportFilterOption[];
  coordinatorOptions: ReportFilterOption[];
  applied: AppliedSummaryFilters;
  /** True for Nova viewers (all organizations); false for org-scoped viewers. */
  novaScope: boolean;
}

/** The in-progress lifecycle tier (placement-lifecycle.md): Onboarding, Active, Paused. */
const IN_PROGRESS_STATUSES = ACTIVE_PLACEMENT_STATUSES;

const SORT_KEYS: readonly SummarySortKey[] = [
  "participant",
  "organization",
  "stage",
  "start",
];

/** Lifecycle order for the stage sort — Onboarding before Active before Paused. */
const STAGE_ORDER: Record<string, number> = {
  [PlacementStatus.ONBOARDING]: 0,
  [PlacementStatus.ACTIVE]: 1,
  [PlacementStatus.PAUSED]: 2,
};

/** @db.Date fields render in UTC so the calendar date never shifts. */
function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseAppliedFilters(
  filters: ActivePlacementSummaryFilters,
): AppliedSummaryFilters {
  const stage = (IN_PROGRESS_STATUSES as readonly string[]).includes(filters.stage ?? "")
    ? (filters.stage as PlacementStatus)
    : null;
  const sort = (SORT_KEYS as readonly string[]).includes(filters.sort ?? "")
    ? (filters.sort as SummarySortKey)
    : "organization";
  const direction = filters.direction === "desc" ? "desc" : "asc";
  return {
    organizationId: filters.organizationId || null,
    stage,
    coordinatorUserId: filters.coordinatorUserId || null,
    sort,
    direction,
  };
}

function compareRows(
  a: ActivePlacementSummaryRow,
  b: ActivePlacementSummaryRow,
  sort: SummarySortKey,
): number {
  switch (sort) {
    case "participant":
      return a.participantName.localeCompare(b.participantName);
    case "stage":
      return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    case "start":
      // Missing start dates sort after dated rows in the base (ascending) order.
      if (a.startDateIso === b.startDateIso) return 0;
      if (a.startDateIso === null) return 1;
      if (b.startDateIso === null) return -1;
      return a.startDateIso.localeCompare(b.startDateIso);
    case "organization":
      return a.organizationName.localeCompare(b.organizationName);
  }
}

/**
 * The Active Placement Summary (Story 7.1): every in-progress placement
 * (Onboarding, Active, Paused) in the viewer's scope with participant,
 * host, site, supervisor, coordinator, stage, and start date. Terminal
 * and pre-onboarding placements never appear (AC4). Filters narrow by
 * host organization, lifecycle stage, and coordinator (AC2); filter
 * options are drawn from the viewer's scoped result set, so an
 * org-scoped viewer never learns other organizations' names.
 */
export async function getActivePlacementSummary(
  ctx: AuthContext,
  filters: ActivePlacementSummaryFilters = {},
): Promise<ActivePlacementSummaryView> {
  requirePermission(ctx, "reporting.view");

  const novaScope = hasNovaScope(ctx);
  const memberOrganizationIds = ctx.memberships.map((m) => m.organizationId);
  const applied = parseAppliedFilters(filters);

  const placements = await prisma.placement.findMany({
    where: {
      status: { in: [...IN_PROGRESS_STATUSES] },
      // Organization scope is the service's own responsibility: shelter
      // viewers are restricted to their memberships' organizations; a
      // requested filter can only narrow within that scope, never widen it.
      ...(novaScope ? {} : { hostOrganizationId: { in: memberOrganizationIds } }),
    },
    select: {
      id: true,
      placementNumber: true,
      status: true,
      startDate: true,
      supervisorId: true,
      coordinatorUserId: true,
      hostOrganization: { select: { id: true, name: true } },
      organizationSite: { select: { name: true } },
      participant: {
        select: {
          person: { select: { legalFirstName: true, legalLastName: true } },
        },
      },
    },
  });

  // Staff names resolve through one user lookup — supervisorId and
  // coordinatorUserId are user ids (Story 5.2).
  const staffIds = new Set<string>();
  for (const placement of placements) {
    if (placement.supervisorId) staffIds.add(placement.supervisorId);
    if (placement.coordinatorUserId) staffIds.add(placement.coordinatorUserId);
  }
  const staff = staffIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...staffIds] } },
        select: { id: true, displayName: true },
      })
    : [];
  const nameById = new Map(staff.map((user) => [user.id, user.displayName]));

  const allRows: ActivePlacementSummaryRow[] = placements.map((placement) => ({
    placementId: placement.id,
    placementNumber: placement.placementNumber,
    participantName: `${placement.participant.person.legalFirstName} ${placement.participant.person.legalLastName}`,
    organizationName: placement.hostOrganization.name,
    siteName: placement.organizationSite.name,
    supervisorName: placement.supervisorId
      ? (nameById.get(placement.supervisorId) ?? "Unknown user")
      : null,
    coordinatorName: placement.coordinatorUserId
      ? (nameById.get(placement.coordinatorUserId) ?? "Unknown user")
      : null,
    stage: placement.status,
    stageLabel: PLACEMENT_STATUS_LABELS[placement.status],
    startDateIso: placement.startDate
      ? placement.startDate.toISOString().slice(0, 10)
      : null,
    startDateLabel: placement.startDate ? formatReportDate(placement.startDate) : null,
  }));

  // Filter options come from the scoped, unfiltered set so narrowing one
  // filter never empties the others' choices.
  const organizationOptions = dedupeOptions(
    placements.map((p) => ({ value: p.hostOrganization.id, label: p.hostOrganization.name })),
  );
  const coordinatorOptions = dedupeOptions(
    placements
      .filter((p) => p.coordinatorUserId)
      .map((p) => ({
        value: p.coordinatorUserId as string,
        label: nameById.get(p.coordinatorUserId as string) ?? "Unknown user",
      })),
  );
  const stageOptions = IN_PROGRESS_STATUSES.map((status) => ({
    value: status,
    label: PLACEMENT_STATUS_LABELS[status],
  }));

  const organizationIndex = new Map(
    placements.map((p) => [p.id, p.hostOrganization.id]),
  );
  const coordinatorIndex = new Map(
    placements.map((p) => [p.id, p.coordinatorUserId]),
  );
  const filtered = allRows.filter((row) => {
    if (
      applied.organizationId &&
      organizationIndex.get(row.placementId) !== applied.organizationId
    ) {
      return false;
    }
    if (applied.stage && row.stage !== applied.stage) return false;
    if (
      applied.coordinatorUserId &&
      coordinatorIndex.get(row.placementId) !== applied.coordinatorUserId
    ) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const base =
      compareRows(a, b, applied.sort) ||
      a.organizationName.localeCompare(b.organizationName) ||
      a.participantName.localeCompare(b.participantName) ||
      a.placementNumber.localeCompare(b.placementNumber);
    return applied.direction === "desc" ? -base : base;
  });

  return {
    rows: filtered,
    count: filtered.length,
    organizationOptions,
    stageOptions,
    coordinatorOptions,
    applied,
    novaScope,
  };
}

function dedupeOptions(options: ReportFilterOption[]): ReportFilterOption[] {
  const byValue = new Map<string, ReportFilterOption>();
  for (const option of options) {
    if (!byValue.has(option.value)) byValue.set(option.value, option);
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
}
