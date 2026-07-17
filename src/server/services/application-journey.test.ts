import { describe, expect, it } from "vitest";

import { ApplicationStatus, DocumentType } from "@/generated/prisma/client";
import type { ApplicationView } from "./application-service";
import { JOURNEY_STEP_KEYS, toJourneyView } from "./application-journey";

const S = ApplicationStatus;

function view(status: ApplicationStatus, overrides: Partial<ApplicationView> = {}): ApplicationView {
  return {
    id: "app_1",
    applicationNumber: "APP-2026-ABC234",
    status,
    statusLabel: "",
    statusTone: "neutral",
    motivation: "My motivation answer",
    workExperience: "Work answer",
    animalExperience: "Animal answer",
    availabilityNotes: "Availability answer",
    transportationNotes: "Transport answer",
    progressPercent: 100,
    updatedAtToken: "2026-07-02T03:04:05.678Z",
    submittedAtLabel: status === S.DRAFT ? null : "July 12, 2026",
    decidedAt: null,
    ...overrides,
  };
}

describe("toJourneyView (Story 2.6 participant-safe mapping)", () => {
  it("maps EVERY internal status to four simplified steps", () => {
    for (const status of Object.values(S)) {
      const journey = toJourneyView(view(status));
      expect(journey.steps.map((s) => s.key)).toEqual([...JOURNEY_STEP_KEYS]);

      const currents = journey.steps.filter((s) => s.state === "current");
      if (journey.isTerminal) {
        expect(currents, `${status} is decided — no step is 'current'`).toHaveLength(0);
        expect(journey.steps.every((s) => s.state === "done")).toBe(true);
      } else {
        expect(currents, `${status} must have exactly one current step`).toHaveLength(1);
      }
    }
  });

  it("NEVER leaks internal phase names or restricted fields for any status", () => {
    for (const status of Object.values(S)) {
      const serialized = JSON.stringify(toJourneyView(view(status)));
      // Internal review phases collapse into simplified stages (AC2).
      expect(serialized).not.toMatch(/ELIGIBILITY|INTERVIEW|BACKGROUND/i);
      // Restricted and form content is structurally absent, not filtered.
      expect(serialized).not.toContain("decisionReason");
      expect(serialized).not.toContain("motivation answer");
      expect(serialized).not.toMatch(/fail|criminal|bad candidate/i);
    }
  });

  it("gives a DRAFT the Continue Application next step, anchored to the form (AC1)", () => {
    const journey = toJourneyView(view(S.DRAFT));
    expect(journey.steps.find((s) => s.state === "current")?.key).toBe("PREPARE");
    expect(journey.nextStep).toMatchObject({
      actionLabel: "Continue Application",
      actionHref: "#application-form",
      tone: "action",
    });
  });

  it("collapses all four in-flight review statuses into the Review step with 'no action needed'", () => {
    for (const status of [S.SUBMITTED, S.ELIGIBILITY_REVIEW, S.INTERVIEW, S.BACKGROUND_REVIEW]) {
      const journey = toJourneyView(view(status), [DocumentType.GOVERNMENT_ID]);
      expect(journey.steps.find((s) => s.state === "current")?.key).toBe("REVIEW");
      expect(journey.nextStep.tone).toBe("waiting");
      expect(journey.nextStep.description).toMatch(/no action is needed right now/i);
      expect(journey.nextStep.actionLabel).toBeNull();
    }
  });

  it("surfaces the scheduled interview to the applicant — date, time, format only (Story 2.9)", () => {
    const journey = toJourneyView(view(S.INTERVIEW), [DocumentType.GOVERNMENT_ID], {
      scheduledAtLabel: "August 1, 2026 at 10:30 AM",
      formatLabel: "In person",
    });
    expect(journey.nextStep.headline).toBe("Your interview is scheduled");
    expect(journey.nextStep.description).toContain("August 1, 2026 at 10:30 AM");
    expect(journey.nextStep.description).toContain("In person");
    // Still one simplified stage — never the internal phase name.
    expect(JSON.stringify(journey)).not.toMatch(/INTERVIEW/);
  });

  it("keeps the calm 'under review' copy when no appointment exists yet", () => {
    const journey = toJourneyView(view(S.INTERVIEW), [DocumentType.GOVERNMENT_ID], null);
    expect(journey.nextStep.description).toMatch(/no action is needed right now/i);
  });

  it("surfaces 'we need one more document' when a required document goes missing mid-review", () => {
    const journey = toJourneyView(view(S.ELIGIBILITY_REVIEW), []);
    expect(journey.nextStep).toMatchObject({
      headline: "We need one more document",
      actionLabel: "Upload Document",
      actionHref: "#documents",
      tone: "action",
    });
  });

  it("keeps a DRAFT on Continue Application even while documents are missing", () => {
    const journey = toJourneyView(view(S.DRAFT), []);
    expect(journey.nextStep.actionLabel).toBe("Continue Application");
  });

  it("celebrates ACCEPTED and points toward onboarding (AC4)", () => {
    const journey = toJourneyView(view(S.ACCEPTED));
    expect(journey.nextStep.tone).toBe("positive");
    expect(journey.nextStep.description).toMatch(/onboarding/i);
    expect(journey.isTerminal).toBe(true);
  });

  it("closes REJECTED respectfully and states plainly that reapplication is possible (AC3)", () => {
    const journey = toJourneyView(view(S.REJECTED));
    expect(journey.canReapply).toBe(true);
    expect(journey.nextStep.description).toMatch(/you may apply again/i);
    expect(JSON.stringify(journey)).not.toMatch(/reject/i);
  });

  it("states the exact reapply date once a decision timestamp exists (ADR-016, 30 days)", () => {
    const journey = toJourneyView(
      view(S.REJECTED, { decidedAt: "2026-07-12T00:00:00.000Z" }),
    );
    expect(journey.nextStep.description).toContain("on or after August 11, 2026");
  });

  it("closes DISQUALIFIED respectfully with no reapplication and a human contact path", () => {
    const journey = toJourneyView(view(S.DISQUALIFIED));
    expect(journey.canReapply).toBe(false);
    expect(journey.nextStep.description).toMatch(/contact Project Nova/i);
    expect(JSON.stringify(journey)).not.toMatch(/disqualif/i);
  });
});
