import { describe, expect, it } from "vitest";

import { ApplicationStatus } from "@/generated/prisma/client";
import type { Application } from "@/generated/prisma/client";
import {
  APPLICATION_STATUS_LABELS,
  generateApplicationNumber,
  resolveApplicationGateway,
  toApplicationView,
} from "./application-service";

const S = ApplicationStatus;
const history = (...statuses: ApplicationStatus[]) => statuses.map((status) => ({ status }));

describe("resolveApplicationGateway (Story 2.3 rules)", () => {
  it("lets a first-time applicant apply", () => {
    expect(resolveApplicationGateway([])).toEqual({ kind: "can-apply", reapplying: false });
  });

  it("resumes an existing draft instead of creating a duplicate", () => {
    expect(resolveApplicationGateway(history(S.DRAFT))).toEqual({ kind: "resume-draft" });
  });

  it("blocks a second application while one is in review", () => {
    for (const status of [S.SUBMITTED, S.ELIGIBILITY_REVIEW, S.INTERVIEW, S.BACKGROUND_REVIEW]) {
      expect(resolveApplicationGateway(history(status))).toEqual({ kind: "in-review" });
    }
  });

  it("allows reapplication after REJECTED — a new record", () => {
    expect(resolveApplicationGateway(history(S.REJECTED))).toEqual({
      kind: "can-apply",
      reapplying: true,
    });
  });

  it("blocks permanently after DISQUALIFIED, regardless of other history", () => {
    expect(resolveApplicationGateway(history(S.DISQUALIFIED))).toEqual({ kind: "blocked" });
    expect(resolveApplicationGateway(history(S.REJECTED, S.DISQUALIFIED))).toEqual({
      kind: "blocked",
    });
  });

  it("treats ACCEPTED as terminal without reapplication messaging", () => {
    expect(resolveApplicationGateway(history(S.ACCEPTED))).toEqual({
      kind: "can-apply",
      reapplying: false,
    });
  });
});

describe("generateApplicationNumber", () => {
  it("uses the APP-YYYY-XXXXXX shape with an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const number = generateApplicationNumber(2026);
      expect(number).toMatch(/^APP-2026-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      const suffix = number.split("-")[2];
      expect(suffix).not.toMatch(/[01OIL]/); // no lookalike characters in the random part
    }
  });
});

describe("toApplicationView", () => {
  const base: Application = {
    id: "app_1",
    applicationNumber: "APP-2026-ABC234",
    personId: "person_1",
    status: S.DRAFT,
    motivation: "I want steady work.",
    workExperience: null,
    animalExperience: "  ",
    availabilityNotes: "Weekdays",
    transportationNotes: null,
    submittedAt: null,
    decidedAt: null,
    decisionReason: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-02T03:04:05.678Z"),
  };

  it("computes progress from meaningfully filled fields (whitespace doesn't count)", () => {
    expect(toApplicationView(base).progressPercent).toBe(40); // 2 of 5
  });

  it("exposes the updatedAt concurrency token verbatim", () => {
    expect(toApplicationView(base).updatedAtToken).toBe("2026-07-02T03:04:05.678Z");
  });

  it("labels every status with participant-safe language", () => {
    for (const status of Object.values(S)) {
      const label = APPLICATION_STATUS_LABELS[status];
      expect(label, `missing label for ${status}`).toBeTruthy();
      expect(label).not.toMatch(/reject|disqualif|fail/i);
    }
  });
});
