/**
 * Work-hour calculation (Story 6.3) — the authoritative, deterministic
 * path behind WorkEntry.hours and Timesheet.totalHours. Everything is
 * INTEGER arithmetic: times become minutes since midnight, hours become
 * hundredths of an hour, and floating point never participates
 * (RULES.md), so repeated calculation of the same inputs is identical
 * every time. The single rounding moment — minutes to hundredths — uses
 * round-half-up and is documented here as the MVP convention. Totals
 * sum the STORED per-entry values exactly, so a timesheet total always
 * equals the sum of what each entry displays.
 *
 * Same-day shifts only in MVP: an end time at or before the start time
 * (which is what a midnight-crossing shift looks like on one calendar
 * date) is invalid rather than silently miscalculated. No client-
 * supplied hours value is ever accepted — callers pass start/end/break
 * and receive the computed value (testing-strategy.md names this a
 * business-rule unit target: "Work-hour calculations").
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since midnight for a valid HH:MM, or null. */
export function minutesFromTime(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export interface ShiftInput {
  startTime: string;
  endTime: string;
  /** Whole unpaid minutes; 0 when no break was taken. */
  breakMinutes: number;
}

/**
 * Why the shift cannot be calculated, or null when it can (6.2 AC4/AC5;
 * 6.3 AC4). Messages are specific and participant-facing.
 */
export function shiftValidationError(input: ShiftInput): string | null {
  const start = minutesFromTime(input.startTime);
  const end = minutesFromTime(input.endTime);
  if (start === null || end === null) {
    return "Times must be in 24-hour HH:MM form.";
  }
  if (end <= start) {
    return "The shift must end after it starts, on the same day.";
  }
  if (
    !Number.isInteger(input.breakMinutes) ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 24 * 60
  ) {
    return "Break minutes must be a whole number of minutes.";
  }
  if (input.breakMinutes >= end - start) {
    return "The break can't use up the whole shift.";
  }
  return null;
}

/**
 * A valid shift's hours in hundredths of an hour: net minutes converted
 * at minutes*100/60, rounded half-up once. 7h45m -> 775 ("7.75").
 * Callers validate with shiftValidationError first.
 */
export function shiftHourHundredths(input: ShiftInput): number {
  const start = minutesFromTime(input.startTime);
  const end = minutesFromTime(input.endTime);
  if (start === null || end === null || end <= start) {
    throw new Error("shiftHourHundredths requires a validated same-day shift");
  }
  const netMinutes = end - start - input.breakMinutes;
  return Math.round((netMinutes * 100) / 60);
}

/** "7.75" from 775 — the Decimal-shaped string stored and displayed. */
export function hoursStringFromHundredths(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const fraction = hundredths % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** Exact hundredths from a stored "X.YY" hours string. */
export function hundredthsFromHoursString(value: string): number {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Not a stored hours value: ${value}`);
  }
  return Number(match[1]) * 100 + Number(match[2]);
}

/**
 * The timesheet total: the exact sum of the STORED per-entry hours
 * (6.3 AC2) — never a client-supplied total, never recomputed from raw
 * times in a way that could disagree with what each entry displays.
 */
export function totalHoursString(entryHours: readonly string[]): string {
  const total = entryHours.reduce(
    (sum, value) => sum + hundredthsFromHoursString(value),
    0,
  );
  return hoursStringFromHundredths(total);
}
