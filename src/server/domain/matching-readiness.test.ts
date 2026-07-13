import { describe, expect, it } from "vitest";

import {
  ActiveStatus,
  OnboardingTaskStatus,
  TrainingEnrollmentStatus,
} from "@/generated/prisma/client";
import { computeMatchingReadiness, type ReadinessInputs } from "./matching-readiness";

const NOW = new Date("2026-07-12T12:00:00.000Z");

function inputs(overrides: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return {
    tasks: [
      {
        id: "t1",
        title: "Attend orientation",
        required: true,
        status: OnboardingTaskStatus.COMPLETE,
      },
    ],
    trainingPrograms: [{ id: "tp1", name: "Workplace Readiness", requiredForMatching: true }],
    trainingAttempts: [
      { trainingProgramId: "tp1", status: TrainingEnrollmentStatus.COMPLETED },
    ],
    certifications: [
      {
        id: "c1",
        name: "Pet CPR",
        requiredForMatching: true,
        status: ActiveStatus.ACTIVE,
        expiresOn: new Date("2028-01-01T00:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

describe("computeMatchingReadiness (Story 3.6 — the 3.7 gate)", () => {
  it("is ready with an empty blocker list when every requirement is satisfied (AC3)", () => {
    expect(computeMatchingReadiness(inputs(), NOW)).toEqual({ ready: true, blockers: [] });
  });

  it("flags every incomplete required task, with its title and section anchor (AC1)", () => {
    const result = computeMatchingReadiness(
      inputs({
        tasks: [
          { id: "t1", title: "Attend orientation", required: true, status: OnboardingTaskStatus.NOT_STARTED },
          { id: "t2", title: "Optional extra", required: false, status: OnboardingTaskStatus.NOT_STARTED },
        ],
      }),
      NOW,
    );
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual([
      {
        kind: "task",
        id: "t1",
        label: "Attend orientation",
        detail: "Required onboarding task not complete",
        anchor: "#onboarding-tasks",
      },
    ]);
  });

  it("flags required training without a COMPLETED attempt — in-flight is not done (AC2)", () => {
    const result = computeMatchingReadiness(
      inputs({
        trainingAttempts: [
          { trainingProgramId: "tp1", status: TrainingEnrollmentStatus.IN_PROGRESS },
        ],
      }),
      NOW,
    );
    expect(result.blockers.map((b) => b.kind)).toEqual(["training"]);
    expect(result.blockers[0].anchor).toBe("#training");
  });

  it("never blocks on optional training programs", () => {
    const result = computeMatchingReadiness(
      inputs({
        trainingPrograms: [
          { id: "tp1", name: "Workplace Readiness", requiredForMatching: true },
          { id: "tp2", name: "Digital Skills (optional)", requiredForMatching: false },
        ],
      }),
      NOW,
    );
    expect(result.ready).toBe(true);
  });

  it("flags an EXPIRED required certification as outstanding (AC2; 3.5 AC2)", () => {
    const result = computeMatchingReadiness(
      inputs({
        certifications: [
          {
            id: "c1",
            name: "Pet CPR",
            requiredForMatching: true,
            status: ActiveStatus.ACTIVE,
            expiresOn: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }),
      NOW,
    );
    expect(result.blockers).toEqual([
      {
        kind: "certification",
        id: "c1",
        label: "Pet CPR",
        detail: "Required certification has expired",
        anchor: "#certifications",
      },
    ]);
  });

  it("does not block on missing, optional, or archived certifications (ADR-017)", () => {
    // Never recorded -> not a blocker (credentials gate tasks, not readiness).
    expect(
      computeMatchingReadiness(inputs({ certifications: [] }), NOW).ready,
    ).toBe(true);
    // Optional expired -> not a blocker.
    expect(
      computeMatchingReadiness(
        inputs({
          certifications: [
            {
              id: "c1",
              name: "Optional cred",
              requiredForMatching: false,
              status: ActiveStatus.ACTIVE,
              expiresOn: new Date("2020-01-01T00:00:00.000Z"),
            },
          ],
        }),
        NOW,
      ).ready,
    ).toBe(true);
    // Archived required -> no longer a demand.
    expect(
      computeMatchingReadiness(
        inputs({
          certifications: [
            {
              id: "c1",
              name: "Old required cred",
              requiredForMatching: true,
              status: ActiveStatus.INACTIVE,
              expiresOn: new Date("2020-01-01T00:00:00.000Z"),
            },
          ],
        }),
        NOW,
      ).ready,
    ).toBe(true);
  });

  it("aggregates blockers across all three sources at once", () => {
    const result = computeMatchingReadiness(
      inputs({
        tasks: [
          { id: "t1", title: "Attend orientation", required: true, status: OnboardingTaskStatus.NOT_STARTED },
        ],
        trainingAttempts: [],
        certifications: [
          {
            id: "c1",
            name: "Pet CPR",
            requiredForMatching: true,
            status: ActiveStatus.ACTIVE,
            expiresOn: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }),
      NOW,
    );
    expect(result.ready).toBe(false);
    expect(result.blockers.map((b) => b.kind)).toEqual(["task", "training", "certification"]);
  });
});
