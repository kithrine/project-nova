import { describe, expect, it } from "vitest";

import { fieldErrorsFromZod, onboardingInputSchema } from "./validation";

const valid = {
  legalFirstName: "Jordan",
  legalLastName: "Avery",
  dateOfBirth: "1990-04-12",
  phone: "(555) 010-4477",
  mailingAddressLine1: "12 Harbor Lane",
  mailingAddressLine2: "",
  city: "Springfield",
  region: "WA",
  postalCode: "98101",
};

describe("onboardingInputSchema", () => {
  it("accepts a complete valid input and normalizes the optional line 2", () => {
    const result = onboardingInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mailingAddressLine2).toBeUndefined();
      expect(result.data.legalFirstName).toBe("Jordan");
    }
  });

  it("requires names", () => {
    const result = onboardingInputSchema.safeParse({ ...valid, legalFirstName: "  " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).legalFirstName).toMatch(/legal first name/i);
    }
  });

  it("rejects a malformed date of birth", () => {
    expect(
      onboardingInputSchema.safeParse({ ...valid, dateOfBirth: "04/12/1990" }).success,
    ).toBe(false);
  });

  it("rejects a date of birth in the future", () => {
    const nextYear = new Date().getFullYear() + 1;
    const result = onboardingInputSchema.safeParse({
      ...valid,
      dateOfBirth: `${nextYear}-01-01`,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).dateOfBirth).toMatch(/past/i);
    }
  });

  it("asks for a double-check on implausibly old years (not an eligibility rule)", () => {
    expect(
      onboardingInputSchema.safeParse({ ...valid, dateOfBirth: "1850-01-01" }).success,
    ).toBe(false);
  });

  it("does not enforce any minimum age — eligibility is decided during review", () => {
    // A recent (clearly minor) birth date is well-formed data; age rules are
    // open policy (docs/planning/open-questions.md #1) and belong to review (2.8).
    const lastYear = new Date().getFullYear() - 1;
    expect(
      onboardingInputSchema.safeParse({ ...valid, dateOfBirth: `${lastYear}-06-01` })
        .success,
    ).toBe(true);
  });

  it("rejects phone numbers that cannot be reached", () => {
    expect(onboardingInputSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
    expect(onboardingInputSchema.safeParse({ ...valid, phone: "12" }).success).toBe(false);
  });

  it("requires the mailing address, city, region, and postal code", () => {
    for (const field of ["mailingAddressLine1", "city", "region", "postalCode"] as const) {
      const result = onboardingInputSchema.safeParse({ ...valid, [field]: "" });
      expect(result.success, `${field} should be required`).toBe(false);
    }
  });
});
