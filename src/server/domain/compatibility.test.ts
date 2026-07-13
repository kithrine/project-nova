import { describe, expect, it } from "vitest";

import {
  evaluateCompatibility,
  type CompatibilityInputs,
} from "./compatibility";

const NOW = new Date("2026-07-13T12:00:00.000Z");

/** A pairing where everything clears — the AC1 baseline. */
function clearInputs(overrides: Partial<CompatibilityInputs> = {}): CompatibilityInputs {
  return {
    availabilityNotes: "Weekday mornings",
    transportationNotes: "Bus line 7",
    requiredTrainingTotal: 3,
    requiredTrainingCompleted: 3,
    requiredCertifications: [{ name: "Pet CPR", satisfied: true }],
    siteCapacity: 2,
    supervisorCount: 1,
    proposedSchedule: "Mon/Wed/Fri mornings",
    proposedStartDate: new Date("2026-08-01T00:00:00.000Z"),
    proposedEndDate: new Date("2026-12-01T00:00:00.000Z"),
    hasApprovedRestriction: false,
    ...overrides,
  };
}

describe("evaluateCompatibility (Story 4.2; ADR-011)", () => {
  it("returns Compatible with supporting factors when everything clears (AC1)", () => {
    const result = evaluateCompatibility(clearInputs(), NOW);

    expect(result.category).toBe("COMPATIBLE");
    expect(result.categoryLabel).toBe("Compatible");
    expect(result.factors.every((f) => f.status === "CLEAR")).toBe(true);
    expect(result.factors.map((f) => f.key)).toEqual([
      "availability",
      "certifications",
      "training",
      "capacity",
      "supervision",
      "schedule",
      "transportation",
      "dates",
    ]);
  });

  it("names the specific factor behind a Potential concern (AC2)", () => {
    const result = evaluateCompatibility(
      clearInputs({ proposedStartDate: new Date("2026-01-01T00:00:00.000Z") }),
      NOW,
    );
    expect(result.category).toBe("POTENTIAL_CONCERN");
    const dates = result.factors.find((f) => f.key === "dates");
    expect(dates).toMatchObject({
      status: "CONCERN",
      detail: "The proposed start date has already passed.",
    });
  });

  it("blocks on a missing required certification, naming it (AC3)", () => {
    const result = evaluateCompatibility(
      clearInputs({
        requiredCertifications: [
          { name: "Pet CPR", satisfied: false },
          { name: "Food Handler", satisfied: true },
        ],
      }),
      NOW,
    );
    expect(result.category).toBe("BLOCKING_INCOMPATIBILITY");
    expect(result.factors.find((f) => f.key === "certifications")).toMatchObject({
      status: "BLOCKING",
      detail: "Missing or expired: Pet CPR.",
    });
  });

  it("blocks on zero capacity, incomplete training, no supervisors, and inverted dates", () => {
    expect(
      evaluateCompatibility(clearInputs({ siteCapacity: 0 }), NOW).category,
    ).toBe("BLOCKING_INCOMPATIBILITY");
    expect(
      evaluateCompatibility(clearInputs({ requiredTrainingCompleted: 1 }), NOW).factors.find(
        (f) => f.key === "training",
      )?.detail,
    ).toBe("Training incomplete: 1 of 3 required programs complete.");
    expect(
      evaluateCompatibility(clearInputs({ supervisorCount: 0 }), NOW).category,
    ).toBe("BLOCKING_INCOMPATIBILITY");
    expect(
      evaluateCompatibility(
        clearInputs({
          proposedStartDate: new Date("2026-09-01T00:00:00.000Z"),
          proposedEndDate: new Date("2026-08-01T00:00:00.000Z"),
        }),
        NOW,
      ).factors.find((f) => f.key === "dates")?.status,
    ).toBe("BLOCKING");
  });

  it("answers Unknown / needs review — never a guess — when inputs are missing (AC4)", () => {
    const result = evaluateCompatibility(
      clearInputs({ availabilityNotes: null, proposedSchedule: null }),
      NOW,
    );
    expect(result.category).toBe("UNKNOWN_NEEDS_REVIEW");
    expect(result.factors.find((f) => f.key === "availability")?.status).toBe("UNKNOWN");
  });

  it("orders severity blocking > unknown > concern > clear", () => {
    // Unknown + blocking -> blocking wins.
    expect(
      evaluateCompatibility(
        clearInputs({ proposedSchedule: null, siteCapacity: 0 }),
        NOW,
      ).category,
    ).toBe("BLOCKING_INCOMPATIBILITY");
    // Unknown + concern -> unknown wins.
    expect(
      evaluateCompatibility(
        clearInputs({
          proposedSchedule: null,
          proposedStartDate: new Date("2026-01-01T00:00:00.000Z"),
        }),
        NOW,
      ).category,
    ).toBe("UNKNOWN_NEEDS_REVIEW");
  });

  it("reflects an approved restriction WITHOUT any narrative (AC5)", () => {
    const result = evaluateCompatibility(
      clearInputs({ hasApprovedRestriction: true }),
      NOW,
    );
    expect(result.category).toBe("POTENTIAL_CONCERN");
    const restriction = result.factors.find((f) => f.key === "restriction");
    expect(restriction?.status).toBe("CONCERN");
    // Fixed sentence only — no pathway for restricted content to pass through.
    expect(restriction?.detail).toMatch(/stays restricted/);
    expect(restriction?.detail).not.toMatch(/conviction|offense|background report/i);
  });

  it("never produces a numeric score anywhere (AC6; ADR-011)", () => {
    const serialized = JSON.stringify(evaluateCompatibility(clearInputs(), NOW));
    expect(serialized).not.toMatch(/score|rating|\b\d{1,3}%/i);
  });
});
