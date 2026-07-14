import { describe, expect, it } from "vitest";

import { TimesheetStatus } from "@/generated/prisma/client";
import {
  isoDate,
  mondayOfWeek,
  nextWeek,
  PARTICIPANT_EDITABLE_TIMESHEET_STATUSES,
  parseWeekParam,
  previousWeek,
  weekCreationBlockReason,
  weekEndFor,
  weekLabel,
} from "./timesheet";

describe("timesheet weeks (Story 6.1)", () => {
  it("anchors every date to its Monday, UTC — including Sundays and Mondays themselves", () => {
    // 2026-07-13 is a Monday.
    expect(isoDate(mondayOfWeek(new Date("2026-07-13T00:00:00Z")))).toBe("2026-07-13");
    expect(isoDate(mondayOfWeek(new Date("2026-07-15T23:59:59Z")))).toBe("2026-07-13");
    // Sunday belongs to the week that STARTED the prior Monday.
    expect(isoDate(mondayOfWeek(new Date("2026-07-19T12:00:00Z")))).toBe("2026-07-13");
    expect(isoDate(mondayOfWeek(new Date("2026-07-20T00:00:00Z")))).toBe("2026-07-20");
  });

  it("spans Monday through Sunday and steps by whole weeks", () => {
    const monday = new Date("2026-07-13T00:00:00Z");
    expect(isoDate(weekEndFor(monday))).toBe("2026-07-19");
    expect(isoDate(previousWeek(monday))).toBe("2026-07-06");
    expect(isoDate(nextWeek(monday))).toBe("2026-07-20");
    expect(weekLabel(monday)).toBe("Week of July 13, 2026");
  });

  it("accepts only real Mondays from the query string", () => {
    expect(isoDate(parseWeekParam("2026-07-13")!)).toBe("2026-07-13");
    expect(parseWeekParam("2026-07-14")).toBeNull(); // Tuesday
    expect(parseWeekParam("2026-02-30")).toBeNull(); // not a date
    expect(parseWeekParam("13-07-2026")).toBeNull();
    expect(parseWeekParam(undefined)).toBeNull();
  });

  it("blocks future weeks and weeks before the placement began (AC3/AC4)", () => {
    const today = new Date("2026-07-15T18:00:00Z");
    const start = new Date("2026-07-01T00:00:00Z");
    expect(
      weekCreationBlockReason({
        weekStart: new Date("2026-07-20T00:00:00Z"),
        today,
        placementStartDate: start,
      }),
    ).toMatch(/future week/);
    expect(
      weekCreationBlockReason({
        weekStart: new Date("2026-06-22T00:00:00Z"),
        today,
        placementStartDate: start,
      }),
    ).toMatch(/before your placement began/);
    // The placement's first (partial) week and the current week are fine.
    expect(
      weekCreationBlockReason({
        weekStart: new Date("2026-06-29T00:00:00Z"),
        today,
        placementStartDate: start,
      }),
    ).toBeNull();
    expect(
      weekCreationBlockReason({
        weekStart: new Date("2026-07-13T00:00:00Z"),
        today,
        placementStartDate: null,
      }),
    ).toBeNull();
  });

  it("keeps the participant-editable window to Draft and Rejected (business-rules.md)", () => {
    expect(PARTICIPANT_EDITABLE_TIMESHEET_STATUSES).toEqual([
      TimesheetStatus.DRAFT,
      TimesheetStatus.REJECTED,
    ]);
  });
});
