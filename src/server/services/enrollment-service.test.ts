import { describe, expect, it } from "vitest";

import { EnrollmentStatus } from "@/generated/prisma/client";
import {
  DEFAULT_PROGRAM_CODE,
  ENROLLMENT_STATUS_LABELS,
} from "./enrollment-service";

describe("enrollment service (Story 3.1)", () => {
  it("labels every enrollment status", () => {
    for (const status of Object.values(EnrollmentStatus)) {
      expect(ENROLLMENT_STATUS_LABELS[status], `missing label for ${status}`).toBeTruthy();
    }
  });

  it("resolves the default program by a stable code — never by guessing", () => {
    expect(DEFAULT_PROGRAM_CODE).toBe("NOVA-TE");
  });
});
