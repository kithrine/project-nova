import { describe, expect, it } from "vitest";

import {
  IncidentSeverity,
  IncidentStatus,
  PlacementStatus,
} from "@/generated/prisma/client";
import {
  ALLOWED_INCIDENT_TRANSITIONS,
  assertIncidentTransition,
  INCIDENT_CATEGORIES,
  INCIDENT_REPORTABLE_STATUSES,
  INCIDENT_SEVERITIES,
  incidentValidationError,
  URGENT_INCIDENT_SEVERITIES,
  type IncidentInput,
} from "./incident";

function goodInput(overrides: Partial<IncidentInput> = {}): IncidentInput {
  return {
    category: "SAFETY",
    severity: "MODERATE",
    occurredOn: new Date("2026-08-20T00:00:00.000Z"),
    description: "Slipped on a wet kennel floor; no injury.",
    restrictedDetail: null,
    ...overrides,
  };
}

describe("incident policy (Story 5.11)", () => {
  it("carries exactly the categories and severities from incident-response.md (AC1)", () => {
    expect(INCIDENT_CATEGORIES.map((category) => category.label)).toEqual([
      "Safety",
      "Injury",
      "Animal welfare",
      "Attendance",
      "Conduct",
      "Property",
      "Harassment",
      "Other",
    ]);
    expect(INCIDENT_SEVERITIES.map((severity) => severity.label)).toEqual([
      "Minor",
      "Moderate",
      "Serious",
      "Emergency",
    ]);
    expect(URGENT_INCIDENT_SEVERITIES).toEqual([
      IncidentSeverity.SERIOUS,
      IncidentSeverity.EMERGENCY,
    ]);
  });

  it("validates exactly one category and one severity from the fixed lists (AC1)", () => {
    expect(incidentValidationError(goodInput())).toBeNull();
    expect(incidentValidationError(goodInput({ category: "TORNADO" }))).toMatch(
      /category/i,
    );
    expect(incidentValidationError(goodInput({ severity: "" }))).toMatch(/severity/i);
    expect(
      incidentValidationError(goodInput({ occurredOn: new Date("bad") })),
    ).toMatch(/date/i);
    expect(incidentValidationError(goodInput({ description: "  " }))).toMatch(
      /what happened/i,
    );
    expect(
      incidentValidationError(goodInput({ restrictedDetail: "x".repeat(8001) })),
    ).toMatch(/8,000/);
  });

  it("reports during Onboarding/Active/Paused and after a placement ends — never before site work (lifecycle rules)", () => {
    for (const status of [
      PlacementStatus.ONBOARDING,
      PlacementStatus.ACTIVE,
      PlacementStatus.PAUSED,
      PlacementStatus.COMPLETED,
      PlacementStatus.TERMINATED,
    ]) {
      expect(INCIDENT_REPORTABLE_STATUSES).toContain(status);
    }
    for (const status of [
      PlacementStatus.DRAFT,
      PlacementStatus.PROPOSED,
      PlacementStatus.SHELTER_REVIEW,
      PlacementStatus.APPROVED,
    ]) {
      expect(INCIDENT_REPORTABLE_STATUSES).not.toContain(status);
    }
  });

  it("runs its own machine — Open to Under Review to Closed, closure terminal (AC4/AC6)", () => {
    expect(() =>
      assertIncidentTransition(IncidentStatus.OPEN, IncidentStatus.UNDER_REVIEW),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(IncidentStatus.OPEN, IncidentStatus.CLOSED),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(IncidentStatus.UNDER_REVIEW, IncidentStatus.CLOSED),
    ).not.toThrow();
    expect(ALLOWED_INCIDENT_TRANSITIONS[IncidentStatus.CLOSED]).toEqual([]);
    expect(() =>
      assertIncidentTransition(IncidentStatus.CLOSED, IncidentStatus.OPEN),
    ).toThrow(/cannot move/);
  });
});
