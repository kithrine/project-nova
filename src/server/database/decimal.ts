import { Prisma } from "@/generated/prisma/client";

/**
 * Decimal helpers for money and hours (Story 1.3).
 * RULES.md: use decimal types for money and hours — never floating point.
 * All arithmetic on money or work hours must flow through Prisma.Decimal
 * so values are exact and deterministic (no binary-float drift).
 */

/** Convert whole minutes into decimal hours (e.g. 465 -> 7.75). */
export function decimalHoursFromMinutes(minutes: number): Prisma.Decimal {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError("minutes must be a non-negative integer");
  }
  return new Prisma.Decimal(minutes).div(60);
}

/** Exact sum of decimal values (e.g. timesheet totals from work entries). */
export function sumDecimals(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
}

/** Parse a trusted server-side string into a Decimal (never floats). */
export function decimalFromString(value: string): Prisma.Decimal {
  const trimmed = value.trim();
  if (trimmed === "" || Number.isNaN(Number(trimmed))) {
    throw new RangeError(`not a valid decimal string: "${value}"`);
  }
  return new Prisma.Decimal(trimmed);
}
