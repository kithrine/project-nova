import { describe, expect, it } from "vitest";

import { draftInputSchema } from "./validation";

describe("draftInputSchema (lenient by design)", () => {
  it("accepts a completely empty draft — partial saves must always work", () => {
    const result = draftInputSchema.safeParse({
      motivation: "",
      workExperience: "",
      animalExperience: "",
      availabilityNotes: "",
      transportationNotes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motivation).toBeUndefined();
    }
  });

  it("accepts any subset of answers", () => {
    const result = draftInputSchema.safeParse({
      motivation: "Ready for a fresh start.",
      workExperience: "",
      animalExperience: "",
      availabilityNotes: "",
      transportationNotes: "Bus line 12",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motivation).toBe("Ready for a fresh start.");
      expect(result.data.workExperience).toBeUndefined();
    }
  });

  it("only enforces sane length caps", () => {
    const result = draftInputSchema.safeParse({
      motivation: "x".repeat(2001),
      workExperience: "",
      animalExperience: "",
      availabilityNotes: "",
      transportationNotes: "",
    });
    expect(result.success).toBe(false);
  });
});
