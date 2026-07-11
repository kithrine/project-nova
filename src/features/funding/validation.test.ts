import { describe, expect, it } from "vitest";

import { fieldErrorsFromZod, fundingSourceInputSchema } from "./validation";

const valid = {
  name: "Second Chance Employment Grant",
  kind: "GRANT",
  code: "SCEG-2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  notes: "Pilot cohort award.",
};

describe("fundingSourceInputSchema", () => {
  it("accepts a complete valid input", () => {
    const result = fundingSourceInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("normalizes empty optional fields to undefined", () => {
    const result = fundingSourceInputSchema.safeParse({
      name: "Bare Minimum Grant",
      kind: "OTHER",
      code: "",
      startDate: "",
      endDate: "",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBeUndefined();
      expect(result.data.startDate).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("requires a name", () => {
    const result = fundingSourceInputSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).name).toMatch(/enter a name/i);
    }
  });

  it("rejects an unknown kind", () => {
    const result = fundingSourceInputSchema.safeParse({ ...valid, kind: "DONATION" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).kind).toMatch(/grant, contract, or other/i);
    }
  });

  it("rejects an end date before the start date", () => {
    const result = fundingSourceInputSchema.safeParse({
      ...valid,
      startDate: "2026-06-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).endDate).toMatch(/on or after/i);
    }
  });

  it("rejects malformed dates", () => {
    const result = fundingSourceInputSchema.safeParse({ ...valid, startDate: "01/01/2026" });
    expect(result.success).toBe(false);
  });

  it("caps notes length", () => {
    const result = fundingSourceInputSchema.safeParse({ ...valid, notes: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});
