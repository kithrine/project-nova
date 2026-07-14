import { describe, expect, it } from "vitest";

import {
  hoursStringFromHundredths,
  hundredthsFromHoursString,
  minutesFromTime,
  shiftHourHundredths,
  shiftValidationError,
  totalHoursString,
} from "./work-hours";

/**
 * "Work-hour calculations" — the named business-rule unit target
 * (testing-strategy.md; Story 6.3 AC6).
 */
describe("work-hour calculation (Story 6.3)", () => {
  it("computes (end − start) − break as decimal hours (AC1)", () => {
    // 8:00-16:15 with a 30-minute break = 7h45m = 7.75.
    expect(
      hoursStringFromHundredths(
        shiftHourHundredths({ startTime: "08:00", endTime: "16:15", breakMinutes: 30 }),
      ),
    ).toBe("7.75");
    // Zero-length break.
    expect(
      hoursStringFromHundredths(
        shiftHourHundredths({ startTime: "09:00", endTime: "12:00", breakMinutes: 0 }),
      ),
    ).toBe("3.00");
    // Non-quarter-hour shifts round half-up exactly once: 50 minutes.
    expect(
      hoursStringFromHundredths(
        shiftHourHundredths({ startTime: "10:00", endTime: "10:50", breakMinutes: 0 }),
      ),
    ).toBe("0.83");
  });

  it("totals are the exact sum of stored entry values (AC2)", () => {
    expect(totalHoursString(["7.75", "3.00", "0.83"])).toBe("11.58");
    expect(totalHoursString([])).toBe("0.00");
    // Sub-hour values keep their leading zero and survive the round trip.
    expect(hundredthsFromHoursString("0.83")).toBe(83);
    expect(() => hundredthsFromHoursString("7.7")).toThrow(/Not a stored hours value/);
  });

  it("rejects midnight-crossing and zero-length shifts (AC4)", () => {
    expect(
      shiftValidationError({ startTime: "22:00", endTime: "06:00", breakMinutes: 0 }),
    ).toMatch(/end after it starts, on the same day/);
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "09:00", breakMinutes: 0 }),
    ).toMatch(/end after it starts/);
    expect(
      shiftValidationError({ startTime: "9am", endTime: "17:00", breakMinutes: 0 }),
    ).toMatch(/HH:MM/);
  });

  it("rejects a break consuming the shift or malformed break values", () => {
    // Break equal to the shift length nets zero — invalid, not 0.00.
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "10:00", breakMinutes: 60 }),
    ).toMatch(/whole shift/);
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "10:00", breakMinutes: 90 }),
    ).toMatch(/whole shift/);
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "17:00", breakMinutes: -15 }),
    ).toMatch(/whole number/);
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "17:00", breakMinutes: 12.5 }),
    ).toMatch(/whole number/);
    // A sane shift validates clean.
    expect(
      shiftValidationError({ startTime: "09:00", endTime: "17:00", breakMinutes: 45 }),
    ).toBeNull();
  });

  it("is deterministic across repeated runs — integer math only (AC5)", () => {
    const input = { startTime: "07:10", endTime: "15:37", breakMinutes: 23 };
    const first = shiftHourHundredths(input);
    for (let i = 0; i < 1000; i += 1) {
      expect(shiftHourHundredths(input)).toBe(first);
    }
    // 7h27m gross - 23m break = 484 minutes -> 806.66... -> 807 -> "8.07".
    expect(hoursStringFromHundredths(first)).toBe("8.07");
    expect(minutesFromTime("23:59")).toBe(1439);
    expect(minutesFromTime("24:00")).toBeNull();
  });
});
