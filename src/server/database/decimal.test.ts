import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";

import { decimalFromString, decimalHoursFromMinutes, sumDecimals } from "./decimal";

describe("decimalHoursFromMinutes", () => {
  it("converts whole minutes to exact decimal hours", () => {
    expect(decimalHoursFromMinutes(465).toString()).toBe("7.75");
    expect(decimalHoursFromMinutes(60).toString()).toBe("1");
    expect(decimalHoursFromMinutes(0).toString()).toBe("0");
  });

  it("is exact for decimal fractions and deterministic for repeating ones", () => {
    // 45 minutes = 0.75 — exact, where binary floats would drift
    expect(decimalHoursFromMinutes(45).toString()).toBe("0.75");
    // 20 minutes = 1/3 hour — a repeating fraction; the representation is
    // deterministic (identical every run), which is what timesheet math relies on
    const first = decimalHoursFromMinutes(20).toString();
    const second = decimalHoursFromMinutes(20).toString();
    expect(first).toBe(second);
    expect(first.startsWith("0.3333")).toBe(true);
  });

  it("rejects negative and fractional minutes", () => {
    expect(() => decimalHoursFromMinutes(-1)).toThrow(RangeError);
    expect(() => decimalHoursFromMinutes(1.5)).toThrow(RangeError);
  });
});

describe("sumDecimals", () => {
  it("sums exactly, avoiding 0.1 + 0.2 float drift", () => {
    const values = [new Prisma.Decimal("0.1"), new Prisma.Decimal("0.2")];
    expect(sumDecimals(values).toString()).toBe("0.3");
  });

  it("returns 0 for an empty list", () => {
    expect(sumDecimals([]).toString()).toBe("0");
  });

  it("is deterministic across repeated runs", () => {
    const values = [new Prisma.Decimal("7.75"), new Prisma.Decimal("8.25")];
    expect(sumDecimals(values).toString()).toBe(sumDecimals(values).toString());
  });
});

describe("decimalFromString", () => {
  it("parses valid decimal strings", () => {
    expect(decimalFromString("19.50").toString()).toBe("19.5");
    expect(decimalFromString(" 7.75 ").toString()).toBe("7.75");
  });

  it("rejects invalid strings", () => {
    expect(() => decimalFromString("")).toThrow(RangeError);
    expect(() => decimalFromString("abc")).toThrow(RangeError);
  });
});
