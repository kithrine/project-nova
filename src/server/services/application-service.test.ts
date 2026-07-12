import { describe, expect, it } from "vitest";

import { ApplicationStatus, DocumentType } from "@/generated/prisma/client";
import type { Application } from "@/generated/prisma/client";
import { APPLICATION_PROMPTS } from "@/features/application/prompts";
import {
  APPLICATION_STATUS_LABELS,
  generateApplicationNumber,
  missingSubmissionItems,
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

describe("resolveApplicationGateway — 30-day reapplication window (Story 2.11, ADR-016)", () => {
  const now = new Date("2026-07-12T12:00:00Z");
  const rejected = (decidedAt: string) => ({ status: S.REJECTED, decidedAt });

  it("shows the waiting period as dates — decided day 0, blocked through day 29", () => {
    const gateway = resolveApplicationGateway([rejected("2026-07-01T12:00:00Z")], now);
    expect(gateway).toEqual({
      kind: "waiting-period",
      decidedOnLabel: "July 1, 2026",
      reapplyOnLabel: "July 31, 2026",
    });
  });

  it("reopens exactly at 30 days", () => {
    const boundary = resolveApplicationGateway([rejected("2026-06-12T12:00:00Z")], now);
    expect(boundary).toEqual({ kind: "can-apply", reapplying: true });

    const oneSecondShy = resolveApplicationGateway(
      [rejected("2026-06-12T12:00:01Z")],
      now,
    );
    expect(oneSecondShy.kind).toBe("waiting-period");
  });

  it("uses the MOST RECENT rejection when there are several", () => {
    const gateway = resolveApplicationGateway(
      [rejected("2026-01-01T00:00:00Z"), rejected("2026-07-10T00:00:00Z")],
      now,
    );
    expect(gateway.kind).toBe("waiting-period");
  });

  it("never outranks a draft, an in-review application, or a disqualification", () => {
    const fresh = rejected("2026-07-11T00:00:00Z");
    expect(resolveApplicationGateway([fresh, { status: S.DRAFT }], now).kind).toBe(
      "resume-draft",
    );
    expect(resolveApplicationGateway([fresh, { status: S.SUBMITTED }], now).kind).toBe(
      "in-review",
    );
    expect(resolveApplicationGateway([fresh, { status: S.DISQUALIFIED }], now).kind).toBe(
      "blocked",
    );
  });

  it("keeps legacy rejections without a decision date reapplicable", () => {
    expect(resolveApplicationGateway([{ status: S.REJECTED }], now)).toEqual({
      kind: "can-apply",
      reapplying: true,
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

describe("missingSubmissionItems (Story 2.5 completeness)", () => {
  const complete: Application = {
    id: "app_1",
    applicationNumber: "APP-2026-ABC234",
    personId: "person_1",
    status: S.DRAFT,
    motivation: "I want steady work.",
    workExperience: "Warehouse shifts.",
    animalExperience: "Two dogs at home.",
    availabilityNotes: "Weekdays",
    transportationNotes: "Bus line 7",
    submittedAt: null,
    decidedAt: null,
    decisionReason: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-02T03:04:05.678Z"),
  };
  const view = (overrides: Partial<Application> = {}) =>
    toApplicationView({ ...complete, ...overrides });

  it("returns nothing when every answer and required document is present", () => {
    expect(missingSubmissionItems(view(), [DocumentType.GOVERNMENT_ID])).toEqual([]);
  });

  it("flags a blank answer with the exact label the applicant sees on the form", () => {
    const items = missingSubmissionItems(view({ motivation: null }), [
      DocumentType.GOVERNMENT_ID,
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "field",
      label: "Why do you want to join Project Nova?",
      anchor: "motivation",
    });
  });

  it("treats whitespace-only answers as blank (same rule as draft progress)", () => {
    const items = missingSubmissionItems(view({ animalExperience: "   " }), [
      DocumentType.GOVERNMENT_ID,
    ]);
    expect(items.map((i) => i.anchor)).toEqual(["animalExperience"]);
  });

  it("flags the required document, anchored to its upload control", () => {
    const items = missingSubmissionItems(view(), []);
    expect(items).toEqual([
      expect.objectContaining({
        kind: "document",
        label: "Government-issued ID",
        anchor: `upload-${DocumentType.GOVERNMENT_ID}`,
      }),
    ]);
  });

  it("lists every missing item at once — fields in form order, then documents", () => {
    const items = missingSubmissionItems(
      view({ motivation: null, transportationNotes: "" }),
      [],
    );
    expect(items.map((i) => i.anchor)).toEqual([
      "motivation",
      "transportationNotes",
      `upload-${DocumentType.GOVERNMENT_ID}`,
    ]);
  });

  it("covers every form prompt — a new prompt is automatically required", () => {
    const blank = view({
      motivation: null,
      workExperience: null,
      animalExperience: null,
      availabilityNotes: null,
      transportationNotes: null,
    });
    const fieldItems = missingSubmissionItems(blank, [DocumentType.GOVERNMENT_ID]);
    expect(fieldItems.map((i) => i.anchor)).toEqual(
      APPLICATION_PROMPTS.map((p) => p.name),
    );
  });
});
