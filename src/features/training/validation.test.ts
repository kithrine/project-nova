import { describe, expect, it } from "vitest";

import { trainingEnrollmentInputSchema, trainingTransitionInputSchema } from "./validation";

describe("training boundary validation (Story 3.4)", () => {
  it("accepts a valid enrollment payload", () => {
    expect(
      trainingEnrollmentInputSchema.safeParse({
        trainingProgramId: "program_1",
        enrolledAt: "2026-07-01",
        expectedCompletionDate: "2026-07-10",
        providerName: "Nova Learning Partner",
      }).success,
    ).toBe(true);
  });

  it("rejects expected completion before enrollment", () => {
    expect(
      trainingEnrollmentInputSchema.safeParse({
        trainingProgramId: "program_1",
        enrolledAt: "2026-07-10",
        expectedCompletionDate: "2026-07-01",
        providerName: "",
      }).success,
    ).toBe(false);
  });

  it("accepts only an approved structured completion method", () => {
    expect(
      trainingTransitionInputSchema.safeParse({
        effectiveDate: "2026-07-12",
        completionMethod: "PROVIDER_VERIFICATION",
      }).success,
    ).toBe(true);
    expect(
      trainingTransitionInputSchema.safeParse({
        effectiveDate: "2026-07-12",
        completionMethod: "ATTENDED",
      }).success,
    ).toBe(false);
  });
});
