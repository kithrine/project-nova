import { describe, expect, it } from "vitest";

import { TrainingCompletionMethod, TrainingEnrollmentStatus } from "@/generated/prisma/client";
import {
  assertTrainingTransition,
  getOutstandingRequiredTraining,
  trainingTransitionFields,
} from "./training-enrollment";

describe("training enrollment lifecycle (Story 3.4, ADR-017)", () => {
  const allowed = [
    [TrainingEnrollmentStatus.ENROLLED, TrainingEnrollmentStatus.IN_PROGRESS],
    [TrainingEnrollmentStatus.ENROLLED, TrainingEnrollmentStatus.COMPLETED],
    [TrainingEnrollmentStatus.ENROLLED, TrainingEnrollmentStatus.WITHDRAWN],
    [TrainingEnrollmentStatus.IN_PROGRESS, TrainingEnrollmentStatus.COMPLETED],
    [TrainingEnrollmentStatus.IN_PROGRESS, TrainingEnrollmentStatus.WITHDRAWN],
  ] as const;

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(() => assertTrainingTransition(from, to)).not.toThrow();
  });

  it("rejects every transition from a terminal attempt and repeated transitions", () => {
    for (const from of Object.values(TrainingEnrollmentStatus)) {
      for (const to of Object.values(TrainingEnrollmentStatus)) {
        if (allowed.some(([a, b]) => a === from && b === to)) continue;
        expect(() => assertTrainingTransition(from, to)).toThrow();
      }
    }
  });

  it("requires structured evidence for completion and records the verifier", () => {
    const effectiveDate = new Date("2026-07-12T00:00:00.000Z");
    expect(
      trainingTransitionFields({
        toStatus: TrainingEnrollmentStatus.COMPLETED,
        effectiveDate,
        completionMethod: TrainingCompletionMethod.KNOWLEDGE_ASSESSMENT,
        actorUserId: "user_1",
      }),
    ).toMatchObject({
      completedAt: effectiveDate,
      completionMethod: TrainingCompletionMethod.KNOWLEDGE_ASSESSMENT,
      completionVerifiedByUserId: "user_1",
    });
    expect(() =>
      trainingTransitionFields({
        toStatus: TrainingEnrollmentStatus.COMPLETED,
        effectiveDate,
        completionMethod: null,
        actorUserId: "user_1",
      }),
    ).toThrow(/evidence/i);
  });

  it("maps required catalog programs without a completed attempt to blockers", () => {
    const programs = [
      { id: "work", name: "Workplace Readiness", requiredForMatching: true },
      { id: "animals", name: "Animal Handling", requiredForMatching: true },
      { id: "optional", name: "Financial Skills", requiredForMatching: false },
    ];
    const attempts = [
      { trainingProgramId: "work", status: TrainingEnrollmentStatus.COMPLETED },
      { trainingProgramId: "animals", status: TrainingEnrollmentStatus.WITHDRAWN },
    ];
    expect(getOutstandingRequiredTraining(programs, attempts)).toEqual([
      { trainingProgramId: "animals", name: "Animal Handling" },
    ]);
  });
});
