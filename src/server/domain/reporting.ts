import { PlacementStatus, TimesheetStatus } from "@/generated/prisma/client";
import { TERMINAL_PLACEMENT_STATUSES } from "./placement";
import { hoursStringFromHundredths, hundredthsFromHoursString } from "./work-hours";

/**
 * Reporting domain rules (Story 7.2; ADR-020 — provisional grant
 * reporting format). Pure functions: the reporting period, the
 * Monday-attribution rule, and exact grouping of stored Decimal-shaped
 * hour strings. Floating point never touches an hours value.
 */

export interface ReportRange {
  /** Inclusive ISO dates (YYYY-MM-DD). */
  fromIso: string;
  toIso: string;
  /** True when the requested params were used; false when defaults applied. */
  fromParams: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Resolve the reporting period. Both bounds must be real ISO dates with
 * from <= to; anything else falls back to the default period — the
 * current calendar month (UTC), a natural reimbursement-preparation
 * window. `now` is injected for determinism.
 */
export function parseReportRange(
  params: { from?: string; to?: string },
  now: Date,
): ReportRange {
  const { from, to } = params;
  if (from && to && isRealIsoDate(from) && isRealIsoDate(to) && from <= to) {
    return { fromIso: from, toIso: to, fromParams: true };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return {
    fromIso: first.toISOString().slice(0, 10),
    toIso: last.toISOString().slice(0, 10),
    fromParams: false,
  };
}

/**
 * ADR-020's attribution rule: a timesheet week belongs to the period
 * containing its Monday (`weekStartDate`). Contiguous periods therefore
 * never double-count a week. ISO strings compare lexicographically.
 */
export function mondayWithinRange(weekStartIso: string, range: ReportRange): boolean {
  return weekStartIso >= range.fromIso && weekStartIso <= range.toIso;
}

/**
 * Range resolution for cumulative reports (Story 7.4): where the hours
 * rollup defaults to the current month, an impact summary defaults to
 * the whole program to date — null means unbounded. Only a complete,
 * valid, ordered pair narrows the period; anything else stays cumulative.
 */
export function parseOptionalReportRange(params: {
  from?: string;
  to?: string;
}): ReportRange | null {
  const { from, to } = params;
  if (from && to && isRealIsoDate(from) && isRealIsoDate(to) && from <= to) {
    return { fromIso: from, toIso: to, fromParams: true };
  }
  return null;
}

export interface HoursRollupInput {
  /** Funding source id, or null for placements with no ACTIVE assignment. */
  fundingKey: string | null;
  status: TimesheetStatus;
  /** The stored Decimal-shaped total ("12.34") — summed exactly. */
  totalHours: string;
  placementId: string;
}

export interface HoursRollupGroup {
  fundingKey: string | null;
  /** Exact Decimal-shaped sums, kept strictly separate (never blended). */
  lockedHours: string;
  approvedHours: string;
  lockedTimesheetCount: number;
  approvedTimesheetCount: number;
  placementCount: number;
}

export interface HoursRollup {
  groups: HoursRollupGroup[];
  totalLockedHours: string;
  totalApprovedHours: string;
}

/**
 * Group finalized and approved hours by funding source with exact
 * integer-hundredths arithmetic (Story 6.3's discipline). Only LOCKED
 * and APPROVED timesheets participate; anything else is ignored by
 * construction. LOCKED and APPROVED sums stay separate — ADR-020
 * forbids blending the reimbursement-safe basis with pending totals.
 */
export function rollupHoursByFunding(rows: readonly HoursRollupInput[]): HoursRollup {
  const groups = new Map<
    string | null,
    {
      lockedHundredths: number;
      approvedHundredths: number;
      lockedCount: number;
      approvedCount: number;
      placements: Set<string>;
    }
  >();
  let totalLocked = 0;
  let totalApproved = 0;

  for (const row of rows) {
    if (
      row.status !== TimesheetStatus.LOCKED &&
      row.status !== TimesheetStatus.APPROVED
    ) {
      continue;
    }
    const group = groups.get(row.fundingKey) ?? {
      lockedHundredths: 0,
      approvedHundredths: 0,
      lockedCount: 0,
      approvedCount: 0,
      placements: new Set<string>(),
    };
    const hundredths = hundredthsFromHoursString(row.totalHours);
    if (row.status === TimesheetStatus.LOCKED) {
      group.lockedHundredths += hundredths;
      group.lockedCount += 1;
      totalLocked += hundredths;
    } else {
      group.approvedHundredths += hundredths;
      group.approvedCount += 1;
      totalApproved += hundredths;
    }
    group.placements.add(row.placementId);
    groups.set(row.fundingKey, group);
  }

  return {
    groups: [...groups.entries()].map(([fundingKey, group]) => ({
      fundingKey,
      lockedHours: hoursStringFromHundredths(group.lockedHundredths),
      approvedHours: hoursStringFromHundredths(group.approvedHundredths),
      lockedTimesheetCount: group.lockedCount,
      approvedTimesheetCount: group.approvedCount,
      placementCount: group.placements.size,
    })),
    totalLockedHours: hoursStringFromHundredths(totalLocked),
    totalApprovedHours: hoursStringFromHundredths(totalApproved),
  };
}

// --- Shelter roster (Story 7.3) ----------------------------------------------

export interface RosterSiteInput {
  siteId: string;
  name: string;
  capacity: number;
}

export interface RosterSiteWithCount extends RosterSiteInput {
  activePlacementCount: number;
}

export interface RosterSiteCounts {
  sites: RosterSiteWithCount[];
  /** Sum across the organization's sites. */
  activePlacementCount: number;
  totalCapacity: number;
}

/**
 * Attach active-placement counts to an organization's sites. A site (or a
 * whole shelter) with no active placements reports a ZERO count rather
 * than disappearing (Story 7.3 AC3) — capacity planning needs the empty
 * rows most of all.
 */
export function mergeSiteCounts(
  sites: readonly RosterSiteInput[],
  countBySiteId: ReadonlyMap<string, number>,
): RosterSiteCounts {
  const withCounts = sites.map((site) => ({
    ...site,
    activePlacementCount: countBySiteId.get(site.siteId) ?? 0,
  }));
  return {
    sites: withCounts,
    activePlacementCount: withCounts.reduce((sum, s) => sum + s.activePlacementCount, 0),
    totalCapacity: withCounts.reduce((sum, s) => sum + s.capacity, 0),
  };
}

// --- Outcome summary (Story 7.4) ----------------------------------------------

export interface OutcomeCount {
  status: PlacementStatus;
  count: number;
}

/**
 * Zero-filled outcome counts in the four terminal statuses' canonical
 * order (Story 7.4 AC1) — a category with no placements reports 0 rather
 * than disappearing, and anything non-terminal in the input is ignored
 * by construction.
 */
export function buildOutcomeCounts(
  groups: ReadonlyArray<{ status: PlacementStatus; count: number }>,
): OutcomeCount[] {
  const byStatus = new Map(groups.map((group) => [group.status, group.count]));
  return TERMINAL_PLACEMENT_STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));
}
