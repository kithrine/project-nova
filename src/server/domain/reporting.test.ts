import { describe, expect, it } from "vitest";

import { PlacementStatus, TimesheetStatus } from "@/generated/prisma/enums";

import {
  buildOutcomeCounts,
  mergeSiteCounts,
  mondayWithinRange,
  parseOptionalReportRange,
  parseReportRange,
  rollupHoursByFunding,
} from "./reporting";

const JULY_14 = new Date("2026-07-14T15:30:00.000Z");

describe("parseReportRange (ADR-020)", () => {
  it("uses a valid requested range verbatim", () => {
    const range = parseReportRange({ from: "2026-06-01", to: "2026-06-30" }, JULY_14);
    expect(range).toEqual({ fromIso: "2026-06-01", toIso: "2026-06-30", fromParams: true });
  });

  it("defaults to the current UTC calendar month", () => {
    expect(parseReportRange({}, JULY_14)).toEqual({
      fromIso: "2026-07-01",
      toIso: "2026-07-31",
      fromParams: false,
    });
    // Month-length and year boundaries hold (leap February; December).
    expect(parseReportRange({}, new Date("2028-02-10T00:00:00Z")).toIso).toBe("2028-02-29");
    expect(parseReportRange({}, new Date("2026-12-05T00:00:00Z"))).toMatchObject({
      fromIso: "2026-12-01",
      toIso: "2026-12-31",
    });
  });

  it("falls back to the default for malformed, impossible, or inverted ranges", () => {
    for (const params of [
      { from: "06/01/2026", to: "2026-06-30" },
      { from: "2026-06-31", to: "2026-07-02" }, // June 31 does not exist
      { from: "2026-07-10", to: "2026-07-01" }, // inverted
      { from: "2026-06-01" }, // missing bound
      { from: "2026-06-01", to: "not-a-date" },
    ]) {
      const range = parseReportRange(params, JULY_14);
      expect(range.fromParams, JSON.stringify(params)).toBe(false);
      expect(range.fromIso).toBe("2026-07-01");
    }
  });
});

describe("mondayWithinRange (week attribution)", () => {
  const june = parseReportRange({ from: "2026-06-01", to: "2026-06-30" }, JULY_14);

  it("attributes a week to the period containing its Monday", () => {
    expect(mondayWithinRange("2026-06-01", june)).toBe(true);
    expect(mondayWithinRange("2026-06-29", june)).toBe(true); // week spills into July — still June's
    expect(mondayWithinRange("2026-05-25", june)).toBe(false); // May's Monday, even though its week reaches June
    expect(mondayWithinRange("2026-07-06", june)).toBe(false);
  });

  it("never double-counts across contiguous periods", () => {
    const july = parseReportRange({ from: "2026-07-01", to: "2026-07-31" }, JULY_14);
    for (const monday of ["2026-06-29", "2026-07-06"]) {
      expect(mondayWithinRange(monday, june) && mondayWithinRange(monday, july)).toBe(false);
      expect(mondayWithinRange(monday, june) || mondayWithinRange(monday, july)).toBe(true);
    }
  });
});

describe("rollupHoursByFunding (exact Decimal grouping)", () => {
  it("sums exactly by funding source with LOCKED and APPROVED kept separate", () => {
    const rollup = rollupHoursByFunding([
      { fundingKey: "grant-a", status: TimesheetStatus.LOCKED, totalHours: "15.50", placementId: "p1" },
      { fundingKey: "grant-a", status: TimesheetStatus.LOCKED, totalHours: "7.75", placementId: "p2" },
      { fundingKey: "grant-a", status: TimesheetStatus.APPROVED, totalHours: "8.25", placementId: "p1" },
      { fundingKey: "contract-b", status: TimesheetStatus.LOCKED, totalHours: "10.00", placementId: "p3" },
    ]);

    const grantA = rollup.groups.find((g) => g.fundingKey === "grant-a");
    expect(grantA).toMatchObject({
      lockedHours: "23.25",
      approvedHours: "8.25",
      lockedTimesheetCount: 2,
      approvedTimesheetCount: 1,
      placementCount: 2,
    });
    expect(rollup.groups.find((g) => g.fundingKey === "contract-b")).toMatchObject({
      lockedHours: "10.00",
      approvedHours: "0.00",
    });
    expect(rollup.totalLockedHours).toBe("33.25");
    expect(rollup.totalApprovedHours).toBe("8.25");
  });

  it("avoids the float trap 0.10 + 0.20", () => {
    const rollup = rollupHoursByFunding([
      { fundingKey: "g", status: TimesheetStatus.LOCKED, totalHours: "0.10", placementId: "p1" },
      { fundingKey: "g", status: TimesheetStatus.LOCKED, totalHours: "0.20", placementId: "p1" },
    ]);
    expect(rollup.groups[0].lockedHours).toBe("0.30");
  });

  it("buckets placements without an active assignment under the null key", () => {
    const rollup = rollupHoursByFunding([
      { fundingKey: null, status: TimesheetStatus.LOCKED, totalHours: "5.25", placementId: "p4" },
    ]);
    expect(rollup.groups[0]).toMatchObject({ fundingKey: null, lockedHours: "5.25" });
  });

  it("ignores non-finalized, non-approved statuses by construction", () => {
    const rollup = rollupHoursByFunding([
      { fundingKey: "g", status: TimesheetStatus.SUBMITTED, totalHours: "6.00", placementId: "p1" },
      { fundingKey: "g", status: TimesheetStatus.DRAFT, totalHours: "1.00", placementId: "p1" },
      { fundingKey: "g", status: TimesheetStatus.REJECTED, totalHours: "2.00", placementId: "p1" },
    ]);
    expect(rollup.groups).toHaveLength(0);
    expect(rollup.totalLockedHours).toBe("0.00");
  });

  it("keeps one placement's hours in exactly one group (ADR-010 — no blending)", () => {
    const rollup = rollupHoursByFunding([
      { fundingKey: "grant-a", status: TimesheetStatus.LOCKED, totalHours: "4.00", placementId: "p1" },
      { fundingKey: "grant-a", status: TimesheetStatus.LOCKED, totalHours: "4.00", placementId: "p1" },
    ]);
    expect(rollup.groups).toHaveLength(1);
    expect(rollup.groups[0].placementCount).toBe(1);
    expect(rollup.groups[0].lockedHours).toBe("8.00");
  });
});

describe("parseOptionalReportRange (Story 7.4 — cumulative default)", () => {
  it("uses a complete valid range", () => {
    expect(parseOptionalReportRange({ from: "2026-02-01", to: "2026-02-28" })).toEqual({
      fromIso: "2026-02-01",
      toIso: "2026-02-28",
      fromParams: true,
    });
  });

  it("stays cumulative (null) for missing, partial, malformed, or inverted params", () => {
    for (const params of [
      {},
      { from: "2026-02-01" },
      { to: "2026-02-28" },
      { from: "bad", to: "2026-02-28" },
      { from: "2026-02-30", to: "2026-03-05" }, // Feb 30 does not exist
      { from: "2026-03-05", to: "2026-02-01" }, // inverted
    ]) {
      expect(parseOptionalReportRange(params), JSON.stringify(params)).toBeNull();
    }
  });
});

describe("buildOutcomeCounts (Story 7.4)", () => {
  it("zero-fills all four terminal outcomes in canonical order", () => {
    const counts = buildOutcomeCounts([
      { status: PlacementStatus.TERMINATED, count: 2 },
      { status: PlacementStatus.COMPLETED, count: 5 },
    ]);
    expect(counts).toEqual([
      { status: PlacementStatus.COMPLETED, count: 5 },
      { status: PlacementStatus.CONVERTED_TO_PERMANENT, count: 0 },
      { status: PlacementStatus.WITHDRAWN, count: 0 },
      { status: PlacementStatus.TERMINATED, count: 2 },
    ]);
  });

  it("ignores non-terminal statuses by construction", () => {
    const counts = buildOutcomeCounts([
      { status: PlacementStatus.ACTIVE, count: 9 },
      { status: PlacementStatus.DRAFT, count: 3 },
    ]);
    expect(counts.every((entry) => entry.count === 0)).toBe(true);
    expect(counts).toHaveLength(4);
  });
});

describe("mergeSiteCounts (Story 7.3 roster aggregation)", () => {
  it("sums active placements per organization across its sites", () => {
    const merged = mergeSiteCounts(
      [
        { siteId: "s1", name: "Main", capacity: 4 },
        { siteId: "s2", name: "Annex", capacity: 2 },
      ],
      new Map([
        ["s1", 3],
        ["s2", 1],
      ]),
    );
    expect(merged.activePlacementCount).toBe(4);
    expect(merged.totalCapacity).toBe(6);
    expect(merged.sites.map((s) => s.activePlacementCount)).toEqual([3, 1]);
  });

  it("reports zero for sites and shelters with no active placements (AC3)", () => {
    const merged = mergeSiteCounts(
      [{ siteId: "s1", name: "Main", capacity: 3 }],
      new Map(),
    );
    expect(merged.sites[0].activePlacementCount).toBe(0);
    expect(merged.activePlacementCount).toBe(0);
  });

  it("ignores counts for sites outside the organization", () => {
    const merged = mergeSiteCounts(
      [{ siteId: "s1", name: "Main", capacity: 3 }],
      new Map([["other-org-site", 9]]),
    );
    expect(merged.activePlacementCount).toBe(0);
  });
});
