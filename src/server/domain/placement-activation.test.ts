import { describe, expect, it } from "vitest";

import {
  EnrollmentStatus,
  ParticipantMatchDecision,
  PlacementStatus,
  ShelterMatchDecision,
} from "@/generated/prisma/client";
import {
  activationBlocksApply,
  evaluateActivationPrerequisites,
  openActivationBlockers,
  type ActivationSnapshot,
} from "@/server/domain/placement-activation";

/** A snapshot with every prerequisite met, overridden per test. */
function clearSnapshot(overrides: Partial<ActivationSnapshot> = {}): ActivationSnapshot {
  return {
    status: PlacementStatus.ONBOARDING,
    enrollmentStatus: EnrollmentStatus.READY_FOR_MATCHING,
    participantDecision: ParticipantMatchDecision.ACCEPTED,
    shelterDecision: ShelterMatchDecision.APPROVED,
    hostOrganizationAssigned: true,
    siteAssigned: true,
    supervisorAssigned: true,
    coordinatorAssigned: true,
    enrollmentTasksOutstanding: 0,
    trainingOutstanding: 0,
    certificationsOutstanding: 0,
    siteTasksGenerated: true,
    siteTasksOutstanding: 0,
    scheduleAssigned: true,
    fundingActive: true,
    conflictingPlacementNumber: null,
    ...overrides,
  };
}

describe("evaluateActivationPrerequisites", () => {
  it("evaluates all eleven documented prerequisites, in the doc's order", () => {
    const titles = evaluateActivationPrerequisites(clearSnapshot()).map(
      (item) => item.title,
    );
    expect(titles).toEqual([
      "Valid enrollment",
      "Participant accepted",
      "Shelter approved",
      "Host and site assigned",
      "Supervisor and coordinator assigned",
      "Onboarding complete",
      "Portable training and required certifications complete",
      "Host-site safety orientation and assigned-task competency confirmed",
      "Schedule confirmed",
      "Active funding assignment",
      "No conflicting active placement",
    ]);
  });

  it("returns no open blockers when every prerequisite is met (AC2)", () => {
    expect(openActivationBlockers(clearSnapshot())).toEqual([]);
  });

  const singles: [string, Partial<ActivationSnapshot>, string][] = [
    [
      "enrollment not in good standing",
      { enrollmentStatus: EnrollmentStatus.ONBOARDING },
      "Valid enrollment",
    ],
    [
      "participant decision pending",
      { participantDecision: ParticipantMatchDecision.PENDING },
      "Participant accepted",
    ],
    [
      "participant declined",
      { participantDecision: ParticipantMatchDecision.DECLINED },
      "Participant accepted",
    ],
    [
      "shelter decision pending",
      { shelterDecision: ShelterMatchDecision.PENDING },
      "Shelter approved",
    ],
    ["site missing", { siteAssigned: false }, "Host and site assigned"],
    [
      "supervisor missing",
      { supervisorAssigned: false },
      "Supervisor and coordinator assigned",
    ],
    [
      "coordinator missing",
      { coordinatorAssigned: false },
      "Supervisor and coordinator assigned",
    ],
    [
      "program onboarding tasks outstanding",
      { enrollmentTasksOutstanding: 2 },
      "Onboarding complete",
    ],
    [
      "required training outstanding",
      { trainingOutstanding: 1 },
      "Portable training and required certifications complete",
    ],
    [
      "required certification expired",
      { certificationsOutstanding: 1 },
      "Portable training and required certifications complete",
    ],
    [
      "site tasks outstanding",
      { siteTasksOutstanding: 3 },
      "Host-site safety orientation and assigned-task competency confirmed",
    ],
    [
      "site tasks never generated",
      { siteTasksGenerated: false, siteTasksOutstanding: 0 },
      "Host-site safety orientation and assigned-task competency confirmed",
    ],
    ["no active funding", { fundingActive: false }, "Active funding assignment"],
    [
      "conflicting active placement",
      { conflictingPlacementNumber: "PLC-2026-000042" },
      "No conflicting active placement",
    ],
  ];

  it.each(singles)("opens exactly one blocker for %s (AC1)", (_name, overrides, title) => {
    const open = openActivationBlockers(clearSnapshot(overrides));
    expect(open.map((item) => item.title)).toEqual([title]);
  });

  it("accumulates every unmet prerequisite with nothing extraneous (AC1)", () => {
    const open = openActivationBlockers(
      clearSnapshot({
        fundingActive: false,
        siteTasksOutstanding: 1,
        trainingOutstanding: 1,
      }),
    );
    expect(open.map((item) => item.title)).toEqual([
      "Portable training and required certifications complete",
      "Host-site safety orientation and assigned-task competency confirmed",
      "Active funding assignment",
    ]);
  });

  it("names the conflicting placement in the blocker's action (AC4)", () => {
    const open = openActivationBlockers(
      clearSnapshot({ conflictingPlacementNumber: "PLC-2026-000007" }),
    );
    expect(open[0].action).toContain("PLC-2026-000007");
  });

  it("treats an assigned schedule as unconfirmed until the package passes shelter review", () => {
    // A change request returns the placement to Draft with its schedule
    // intact — assigned, but no longer confirmed.
    const open = openActivationBlockers(
      clearSnapshot({
        status: PlacementStatus.DRAFT,
        scheduleAssigned: true,
        siteTasksGenerated: false,
      }),
    );
    expect(open.map((item) => item.key)).toContain("schedule");
  });

  it("marks the schedule confirmed once the placement passes the review gate", () => {
    for (const status of [PlacementStatus.APPROVED, PlacementStatus.ONBOARDING]) {
      const items = evaluateActivationPrerequisites(clearSnapshot({ status }));
      expect(items.find((item) => item.key === "schedule")?.met).toBe(true);
    }
  });

  it("varies the site-onboarding action by whether the checklist exists yet", () => {
    const notGenerated = evaluateActivationPrerequisites(
      clearSnapshot({ siteTasksGenerated: false }),
    ).find((item) => item.key === "siteOnboarding");
    expect(notGenerated?.action).toContain("Start placement onboarding");

    const remaining = evaluateActivationPrerequisites(
      clearSnapshot({ siteTasksOutstanding: 2 }),
    ).find((item) => item.key === "siteOnboarding");
    expect(remaining?.action).toContain("remaining site onboarding steps");
  });
});

describe("activationBlocksApply", () => {
  it("applies from Draft through Onboarding and never after (AC6)", () => {
    expect(activationBlocksApply(PlacementStatus.DRAFT)).toBe(true);
    expect(activationBlocksApply(PlacementStatus.PROPOSED)).toBe(true);
    expect(activationBlocksApply(PlacementStatus.SHELTER_REVIEW)).toBe(true);
    expect(activationBlocksApply(PlacementStatus.APPROVED)).toBe(true);
    expect(activationBlocksApply(PlacementStatus.ONBOARDING)).toBe(true);

    expect(activationBlocksApply(PlacementStatus.ACTIVE)).toBe(false);
    expect(activationBlocksApply(PlacementStatus.PAUSED)).toBe(false);
    expect(activationBlocksApply(PlacementStatus.COMPLETED)).toBe(false);
    expect(activationBlocksApply(PlacementStatus.CONVERTED_TO_PERMANENT)).toBe(false);
    expect(activationBlocksApply(PlacementStatus.WITHDRAWN)).toBe(false);
    expect(activationBlocksApply(PlacementStatus.TERMINATED)).toBe(false);
  });
});
