import { describe, expect, it } from "vitest";

import { EvaluationRating, PlacementStatus } from "@/generated/prisma/client";
import {
  EVALUATION_AREAS,
  EVALUATION_RATINGS,
  EVALUATION_SUBMITTABLE_STATUSES,
  evaluationValidationError,
  type EvaluationInput,
} from "./evaluation";

function goodInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    evaluationDate: new Date("2026-08-15T00:00:00.000Z"),
    ratings: {
      reliability: EvaluationRating.MEETS_EXPECTATIONS,
      taskQuality: EvaluationRating.EXCEEDS_EXPECTATIONS,
      teamwork: EvaluationRating.DEVELOPING,
    },
    strengths: "Shows up early and asks good questions.",
    growthAreas: null,
    ...overrides,
  };
}

describe("evaluation rubric (Story 5.10)", () => {
  it("pairs every rating with a text label — never a bare number or color", () => {
    expect(EVALUATION_RATINGS).toHaveLength(4);
    for (const rating of EVALUATION_RATINGS) {
      expect(rating.label.length).toBeGreaterThan(0);
    }
    expect(EVALUATION_AREAS.map((area) => area.key)).toEqual([
      "reliability",
      "taskQuality",
      "teamwork",
    ]);
  });

  it("accepts a complete submission", () => {
    expect(evaluationValidationError(goodInput())).toBeNull();
    expect(
      evaluationValidationError(goodInput({ growthAreas: "Could double-check kennel latches." })),
    ).toBeNull();
  });

  it("names the missing piece: date, each area's rating, and the strengths text", () => {
    expect(
      evaluationValidationError(goodInput({ evaluationDate: new Date("nope") })),
    ).toMatch(/date/i);
    expect(
      evaluationValidationError(
        goodInput({
          ratings: {
            reliability: "",
            taskQuality: EvaluationRating.DEVELOPING,
            teamwork: EvaluationRating.DEVELOPING,
          },
        }),
      ),
    ).toMatch(/reliability and attendance/i);
    expect(
      evaluationValidationError(
        goodInput({
          ratings: {
            reliability: EvaluationRating.DEVELOPING,
            taskQuality: "NOT_A_RATING",
            teamwork: EvaluationRating.DEVELOPING,
          },
        }),
      ),
    ).toMatch(/task quality/i);
    expect(evaluationValidationError(goodInput({ strengths: "   " }))).toMatch(
      /what went well/i,
    );
    expect(
      evaluationValidationError(goodInput({ strengths: "x".repeat(4001) })),
    ).toMatch(/4,000/);
  });

  it("submits only while Active or Paused (AC5)", () => {
    expect(EVALUATION_SUBMITTABLE_STATUSES).toContain(PlacementStatus.ACTIVE);
    expect(EVALUATION_SUBMITTABLE_STATUSES).toContain(PlacementStatus.PAUSED);
    for (const status of [
      PlacementStatus.DRAFT,
      PlacementStatus.PROPOSED,
      PlacementStatus.SHELTER_REVIEW,
      PlacementStatus.APPROVED,
      PlacementStatus.ONBOARDING,
      PlacementStatus.COMPLETED,
      PlacementStatus.TERMINATED,
    ]) {
      expect(EVALUATION_SUBMITTABLE_STATUSES).not.toContain(status);
    }
  });
});
