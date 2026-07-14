import { TimesheetStatus } from "@/generated/prisma/client";

/**
 * Timesheet week policy (Story 6.1). Weeks run Monday-Sunday — a fixed
 * MVP convention — and all week math is UTC date arithmetic on the
 * placement's civil dates; no timezone conversion ever shifts a week
 * boundary. The full status lifecycle lands here with 6.1; transitions
 * past DRAFT belong to 6.4-6.7 (business-rules.md).
 */

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  [TimesheetStatus.DRAFT]: "Draft",
  [TimesheetStatus.SUBMITTED]: "Submitted",
  [TimesheetStatus.APPROVED]: "Approved",
  [TimesheetStatus.REJECTED]: "Needs correction",
  [TimesheetStatus.LOCKED]: "Locked",
};

/** "Participants may edit draft or rejected timesheets" (business-rules.md). */
export const PARTICIPANT_EDITABLE_TIMESHEET_STATUSES: readonly TimesheetStatus[] = [
  TimesheetStatus.DRAFT,
  TimesheetStatus.REJECTED,
];

const DAY_MS = 86_400_000;

/** The Monday (UTC) of the week containing the given date. */
export function mondayOfWeek(date: Date): Date {
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const day = new Date(utcMidnight).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return new Date(utcMidnight - daysSinceMonday * DAY_MS);
}

/** The Sunday ending the week that starts at the given Monday. */
export function weekEndFor(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 6 * DAY_MS);
}

export function previousWeek(weekStart: Date): Date {
  return new Date(weekStart.getTime() - 7 * DAY_MS);
}

export function nextWeek(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * DAY_MS);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a ?week= query value: a valid YYYY-MM-DD that IS a Monday, or
 * null — anything else falls back to the current week rather than
 * trusting client input to place a timesheet on an arbitrary boundary.
 */
export function parseWeekParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (isoDate(parsed) !== value) return null;
  return parsed.getUTCDay() === 1 ? parsed : null;
}

/**
 * Why a timesheet cannot be created for the requested week, or null when
 * it can (Story 6.1 AC3/AC4): future weeks never; weeks before the
 * placement began never — the week range is the placement's active
 * period up to today.
 */
export function weekCreationBlockReason(input: {
  weekStart: Date;
  today: Date;
  placementStartDate: Date | null;
}): string | null {
  const currentWeek = mondayOfWeek(input.today);
  if (input.weekStart.getTime() > currentWeek.getTime()) {
    return "Hours can't be recorded for a future week.";
  }
  if (
    input.placementStartDate &&
    input.weekStart.getTime() < mondayOfWeek(input.placementStartDate).getTime()
  ) {
    return "This week is before your placement began.";
  }
  return null;
}

/** "Week of July 13, 2026" — the card's heading. */
export function weekLabel(weekStart: Date): string {
  return `Week of ${weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}
