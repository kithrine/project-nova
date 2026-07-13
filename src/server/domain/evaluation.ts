import { EvaluationRating, PlacementStatus } from "@/generated/prisma/client";

/**
 * The evaluation rubric (Story 5.10). A fixed MVP catalog, same pattern
 * as 5.4's onboarding catalog: three performance areas, each rated on a
 * four-point labeled scale — ratings always carry their text label, never
 * a bare number or color (component-guidelines.md). Program-validated
 * rubric authoring is future work; this structure is deliberately
 * generic.
 */

export const EVALUATION_RATINGS = [
  { key: EvaluationRating.NEEDS_SUPPORT, label: "Needs support" },
  { key: EvaluationRating.DEVELOPING, label: "Developing" },
  { key: EvaluationRating.MEETS_EXPECTATIONS, label: "Meets expectations" },
  { key: EvaluationRating.EXCEEDS_EXPECTATIONS, label: "Exceeds expectations" },
] as const;

export const EVALUATION_RATING_LABELS: Record<EvaluationRating, string> = {
  [EvaluationRating.NEEDS_SUPPORT]: "Needs support",
  [EvaluationRating.DEVELOPING]: "Developing",
  [EvaluationRating.MEETS_EXPECTATIONS]: "Meets expectations",
  [EvaluationRating.EXCEEDS_EXPECTATIONS]: "Exceeds expectations",
};

export const EVALUATION_AREAS = [
  { key: "reliability", label: "Reliability and attendance" },
  { key: "taskQuality", label: "Task quality and safety" },
  { key: "teamwork", label: "Teamwork and communication" },
] as const;

export type EvaluationAreaKey = (typeof EVALUATION_AREAS)[number]["key"];

/**
 * Evaluations are submitted while the placement is Active or Paused
 * (Story 5.10 lifecycle rules) — earlier stages have no workplace
 * performance to evaluate; history remains readable after terminal.
 */
export const EVALUATION_SUBMITTABLE_STATUSES: readonly PlacementStatus[] = [
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
];

export interface EvaluationInput {
  evaluationDate: Date;
  ratings: Record<EvaluationAreaKey, string>;
  strengths: string;
  growthAreas: string | null;
}

const RATING_KEYS = new Set<string>(Object.values(EvaluationRating));

/** Why the evaluation cannot be saved, or null when it can. */
export function evaluationValidationError(input: EvaluationInput): string | null {
  if (Number.isNaN(input.evaluationDate.getTime())) {
    return "Provide the date this evaluation covers.";
  }
  for (const area of EVALUATION_AREAS) {
    if (!RATING_KEYS.has(input.ratings[area.key])) {
      return `Choose a rating for ${area.label.toLowerCase()}.`;
    }
  }
  if (input.strengths.trim().length === 0) {
    return "Describe what went well before submitting.";
  }
  if (
    input.strengths.length > 4000 ||
    (input.growthAreas !== null && input.growthAreas.length > 4000)
  ) {
    return "Keep each comment under 4,000 characters.";
  }
  return null;
}
