import {
  ActiveStatus,
  FundingAssignmentStatus,
  OrganizationKind,
  PlacementStatus,
  Role,
  TimesheetStatus,
} from "@/generated/prisma/client";
import {
  hasNovaScope,
  requireNovaScope,
  requirePermission,
} from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import {
  ACTIVE_PLACEMENT_STATUSES,
  PLACEMENT_STATUS_LABELS,
} from "@/server/domain/placement";
import {
  mergeSiteCounts,
  parseReportRange,
  rollupHoursByFunding,
  type HoursRollupInput,
} from "@/server/domain/reporting";
import { FUNDING_KIND_LABELS } from "@/server/services/funding-source-service";

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

// --- Approved hours by funding source (Story 7.2; ADR-020) -------------------

export interface HoursByFundingGroupView {
  /** Null identifies the "No funding assigned" bucket. */
  fundingSourceId: string | null;
  name: string;
  kindLabel: string | null;
  /** The award identifier (`FundingSource.code`) when recorded. */
  code: string | null;
  /** Exact Decimal-shaped sums — LOCKED and APPROVED never blend. */
  lockedHours: string;
  approvedHours: string;
  lockedTimesheetCount: number;
  approvedTimesheetCount: number;
  placementCount: number;
}

export interface HoursByFundingView {
  groups: HoursByFundingGroupView[];
  totalLockedHours: string;
  totalApprovedHours: string;
  range: {
    fromIso: string;
    toIso: string;
    fromLabel: string;
    toLabel: string;
    /** False when invalid or missing params fell back to the default month. */
    fromParams: boolean;
  };
}

export const NO_FUNDING_ASSIGNED_LABEL = "No funding assigned";

/**
 * Approved hours by funding source (Story 7.2) — ADR-020's provisional
 * pilot format. Finalized (`LOCKED`) hours are the reimbursement-safe
 * basis; `APPROVED`-but-unlocked totals are reported separately, never
 * blended (AC3). Weeks attribute to the period containing their Monday.
 * Each placement's hours belong entirely to its single ACTIVE funding
 * assignment (ADR-010); placements without one roll up under a flagged
 * "No funding assigned" bucket rather than disappearing silently.
 *
 * Funding reach is Nova-only: `reporting.view` plus Nova scope — an
 * org-scoped shelter viewer is denied here even though the permission
 * covers the 7.1/7.3 organization-scoped reports.
 */
export async function getApprovedHoursByFundingSource(
  ctx: AuthContext,
  filters: { from?: string; to?: string } = {},
): Promise<HoursByFundingView> {
  requirePermission(ctx, "reporting.view");
  requireNovaScope(ctx);

  const range = parseReportRange(filters, new Date());

  const timesheets = await prisma.timesheet.findMany({
    where: {
      status: { in: [TimesheetStatus.LOCKED, TimesheetStatus.APPROVED] },
      weekStartDate: {
        gte: new Date(`${range.fromIso}T00:00:00.000Z`),
        lte: new Date(`${range.toIso}T00:00:00.000Z`),
      },
    },
    select: {
      status: true,
      totalHours: true,
      placementId: true,
      placement: {
        select: {
          fundingAssignments: {
            where: { status: FundingAssignmentStatus.ACTIVE },
            select: {
              fundingSource: {
                select: { id: true, name: true, kind: true, code: true },
              },
            },
          },
        },
      },
    },
  });

  const sourceById = new Map<
    string,
    { name: string; kindLabel: string; code: string | null }
  >();
  const rows: HoursRollupInput[] = timesheets.map((timesheet) => {
    // ADR-010 allows at most one ACTIVE assignment (partial unique index).
    const source = timesheet.placement.fundingAssignments[0]?.fundingSource ?? null;
    if (source && !sourceById.has(source.id)) {
      sourceById.set(source.id, {
        name: source.name,
        kindLabel: FUNDING_KIND_LABELS[source.kind],
        code: source.code,
      });
    }
    return {
      fundingKey: source?.id ?? null,
      status: timesheet.status,
      totalHours: timesheet.totalHours.toFixed(2),
      placementId: timesheet.placementId,
    };
  });

  const rollup = rollupHoursByFunding(rows);
  const groups: HoursByFundingGroupView[] = rollup.groups
    .map((group) => {
      const source = group.fundingKey ? sourceById.get(group.fundingKey) : null;
      return {
        fundingSourceId: group.fundingKey,
        name: source?.name ?? NO_FUNDING_ASSIGNED_LABEL,
        kindLabel: source?.kindLabel ?? null,
        code: source?.code ?? null,
        lockedHours: group.lockedHours,
        approvedHours: group.approvedHours,
        lockedTimesheetCount: group.lockedTimesheetCount,
        approvedTimesheetCount: group.approvedTimesheetCount,
        placementCount: group.placementCount,
      };
    })
    // Named sources alphabetically; the unassigned bucket always last.
    .sort((a, b) => {
      if (a.fundingSourceId === null) return 1;
      if (b.fundingSourceId === null) return -1;
      return a.name.localeCompare(b.name);
    });

  return {
    groups,
    totalLockedHours: rollup.totalLockedHours,
    totalApprovedHours: rollup.totalApprovedHours,
    range: {
      fromIso: range.fromIso,
      toIso: range.toIso,
      fromLabel: formatReportDate(new Date(`${range.fromIso}T00:00:00.000Z`)),
      toLabel: formatReportDate(new Date(`${range.toIso}T00:00:00.000Z`)),
      fromParams: range.fromParams,
    },
  };
}

// --- Shelter roster (Story 7.3) ----------------------------------------------

export interface RosterStaffView {
  name: string;
  email: string;
}

export interface RosterSiteView {
  siteId: string;
  name: string;
  capacity: number;
  activePlacementCount: number;
}

export interface RosterOrganizationView {
  organizationId: string;
  name: string;
  /** Shelter Manager contact(s) — organization-level staff, never participants. */
  managers: RosterStaffView[];
  supervisorNames: string[];
  sites: RosterSiteView[];
  activePlacementCount: number;
  totalCapacity: number;
}

export interface ShelterRosterView {
  organizations: RosterOrganizationView[];
  novaScope: boolean;
}

/**
 * The Shelter Roster (Story 7.3): every participating host organization
 * with its sites, configured capacity, ACTIVE-tier placement counts
 * (Onboarding/Active/Paused), assigned supervisors, and the Shelter
 * Manager contact. Organization-level data only — no participant fields
 * are ever selected (AC4). Nova viewers see all shelters, including
 * those with zero active placements (AC3); a Shelter Manager sees only
 * their own organization(s) (AC2).
 */
export async function getShelterRoster(ctx: AuthContext): Promise<ShelterRosterView> {
  requirePermission(ctx, "reporting.view");

  const novaScope = hasNovaScope(ctx);
  const memberOrganizationIds = ctx.memberships.map((m) => m.organizationId);

  const organizations = await prisma.organization.findMany({
    where: {
      kind: OrganizationKind.HOST,
      ...(novaScope ? {} : { id: { in: memberOrganizationIds } }),
    },
    select: {
      id: true,
      name: true,
      sites: {
        select: { id: true, name: true, capacity: true },
        orderBy: { name: "asc" },
      },
      // Staff roles only — a membership query can never pull participants.
      memberships: {
        where: {
          status: ActiveStatus.ACTIVE,
          role: { in: [Role.SHELTER_MANAGER, Role.SHELTER_SUPERVISOR] },
        },
        select: {
          role: true,
          user: { select: { displayName: true, email: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const counts = await prisma.placement.groupBy({
    by: ["organizationSiteId"],
    where: {
      status: { in: [...ACTIVE_PLACEMENT_STATUSES] },
      hostOrganizationId: { in: organizations.map((o) => o.id) },
    },
    _count: { _all: true },
  });
  const countBySiteId = new Map(
    counts.map((row) => [row.organizationSiteId, row._count._all]),
  );

  return {
    novaScope,
    organizations: organizations.map((organization) => {
      const merged = mergeSiteCounts(
        organization.sites.map((site) => ({
          siteId: site.id,
          name: site.name,
          capacity: site.capacity,
        })),
        countBySiteId,
      );
      return {
        organizationId: organization.id,
        name: organization.name,
        managers: organization.memberships
          .filter((m) => m.role === Role.SHELTER_MANAGER)
          .map((m) => ({ name: m.user.displayName, email: m.user.email }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        supervisorNames: organization.memberships
          .filter((m) => m.role === Role.SHELTER_SUPERVISOR)
          .map((m) => m.user.displayName)
          .sort((a, b) => a.localeCompare(b)),
        sites: merged.sites,
        activePlacementCount: merged.activePlacementCount,
        totalCapacity: merged.totalCapacity,
      };
    }),
  };
}
