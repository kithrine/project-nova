import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/client";
import {
  ALLOWED_PLACEMENT_TRANSITIONS,
  assertPlacementTransition,
  buildPlacementTimeline,
  NON_TERMINAL_PLACEMENT_STATUSES,
  packageMissingPieces,
  PAUSE_REASON_CATEGORIES,
  pauseEventDetail,
  pauseReasonLabel,
  TERMINAL_OUTCOMES,
  terminalEventDetail,
  TERMINATION_REASON_CATEGORIES,
  terminationReasonLabel,
  PLACEMENT_STATUS_LABELS,
  resumeEventDetail,
  scheduleValidationError,
  TERMINAL_PLACEMENT_STATUSES,
} from "./placement";

describe("buildPlacementTimeline (Story 5.1)", () => {
  it("marks the current main-path stage with past stages behind it", () => {
    const timeline = buildPlacementTimeline(PlacementStatus.SHELTER_REVIEW);
    expect(timeline.map((s) => s.state)).toEqual([
      "past",
      "past",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(timeline[2].label).toBe("Shelter review");
  });

  it("renders the Active ⇄ Paused loop with Paused as the current stage", () => {
    const timeline = buildPlacementTimeline(PlacementStatus.PAUSED);
    expect(timeline).toHaveLength(7);
    expect(timeline[5]).toMatchObject({
      status: PlacementStatus.ACTIVE,
      state: "past",
    });
    expect(timeline[6]).toMatchObject({
      status: PlacementStatus.PAUSED,
      state: "current",
    });
  });

  it("closes terminal placements with the terminal stage current and nothing reopening (AC4)", () => {
    for (const terminal of TERMINAL_PLACEMENT_STATUSES) {
      const timeline = buildPlacementTimeline(terminal, PlacementStatus.ACTIVE);
      const last = timeline[timeline.length - 1];
      expect(last).toMatchObject({ status: terminal, state: "current" });
      // Exactly one current stage, ever.
      expect(timeline.filter((s) => s.state === "current")).toHaveLength(1);
    }
  });

  it("bounds a terminal timeline by where the placement actually got to", () => {
    const timeline = buildPlacementTimeline(
      PlacementStatus.WITHDRAWN,
      PlacementStatus.SHELTER_REVIEW,
    );
    // Draft, Proposed, Shelter review reached; Approved onward never were.
    expect(timeline.slice(0, 3).every((s) => s.state === "past")).toBe(true);
    expect(timeline[3].state).toBe("upcoming");
    expect(timeline[5].state).toBe("upcoming");
    expect(timeline[6]).toMatchObject({
      status: PlacementStatus.WITHDRAWN,
      state: "current",
    });
  });

  it("labels every documented stage", () => {
    for (const status of [
      ...NON_TERMINAL_PLACEMENT_STATUSES,
      ...TERMINAL_PLACEMENT_STATUSES,
    ]) {
      expect(PLACEMENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("placement transitions (Story 5.2 onward)", () => {
  it("walks the 5.2 review path and the change-request return to Draft", () => {
    expect(() =>
      assertPlacementTransition(PlacementStatus.DRAFT, PlacementStatus.PROPOSED),
    ).not.toThrow();
    expect(() =>
      assertPlacementTransition(PlacementStatus.PROPOSED, PlacementStatus.SHELTER_REVIEW),
    ).not.toThrow();
    expect(() =>
      assertPlacementTransition(PlacementStatus.SHELTER_REVIEW, PlacementStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertPlacementTransition(PlacementStatus.SHELTER_REVIEW, PlacementStatus.DRAFT),
    ).not.toThrow();
    expect(() =>
      assertPlacementTransition(PlacementStatus.DRAFT, PlacementStatus.ACTIVE),
    ).toThrow(/cannot move from draft to active/i);
  });

  it("keeps every terminal state closed", () => {
    for (const terminal of TERMINAL_PLACEMENT_STATUSES) {
      expect(ALLOWED_PLACEMENT_TRANSITIONS[terminal]).toEqual([]);
    }
  });
});

describe("packageMissingPieces (Story 5.2 AC3)", () => {
  it("names each missing piece and clears when complete", () => {
    expect(
      packageMissingPieces({
        supervisorId: null,
        coordinatorUserId: null,
        hasStructuredSchedule: false,
      }),
    ).toEqual(["Supervisor", "Coordinator of record", "Work schedule"]);
    expect(
      packageMissingPieces({
        supervisorId: "u1",
        coordinatorUserId: "u2",
        hasStructuredSchedule: true,
      }),
    ).toEqual([]);
  });
});

describe("scheduleValidationError (Story 5.2)", () => {
  const good = {
    days: [
      { day: "MONDAY", startTime: "09:00", endTime: "13:00" },
      { day: "WEDNESDAY", startTime: "13:00", endTime: "17:30" },
    ],
    weeklyHoursTarget: "20.5",
  };

  it("accepts a well-formed schedule with decimal hours", () => {
    expect(scheduleValidationError(good)).toBeNull();
  });

  it("rejects empty, duplicated, malformed, inverted, and out-of-range input", () => {
    expect(scheduleValidationError({ ...good, days: [] })).toMatch(/at least one/);
    expect(
      scheduleValidationError({
        ...good,
        days: [good.days[0], { ...good.days[0] }],
      }),
    ).toMatch(/only once/);
    expect(
      scheduleValidationError({
        ...good,
        days: [{ day: "MONDAY", startTime: "9am", endTime: "13:00" }],
      }),
    ).toMatch(/24-hour/);
    expect(
      scheduleValidationError({
        ...good,
        days: [{ day: "MONDAY", startTime: "13:00", endTime: "09:00" }],
      }),
    ).toMatch(/end after it starts/);
    expect(scheduleValidationError({ ...good, weeklyHoursTarget: "20.555" })).toMatch(
      /two decimals/,
    );
    expect(scheduleValidationError({ ...good, weeklyHoursTarget: "81" })).toMatch(
      /between 0 and 80/,
    );
  });
});

describe("pause reasons and cycle records (Story 5.7)", () => {
  it("only Active pauses and only Paused resumes, per the transition table (AC4)", () => {
    for (const status of Object.values(PlacementStatus)) {
      const canPause = ALLOWED_PLACEMENT_TRANSITIONS[status].includes(
        PlacementStatus.PAUSED,
      );
      expect(canPause, `pause from ${status}`).toBe(status === PlacementStatus.ACTIVE);
    }
    expect(ALLOWED_PLACEMENT_TRANSITIONS[PlacementStatus.PAUSED]).toContain(
      PlacementStatus.ACTIVE,
    );
  });

  it("resolves reason labels and rejects unknown categories", () => {
    expect(pauseReasonLabel("MEDICAL_LEAVE")).toBe("Medical leave");
    expect(pauseReasonLabel("NOT_A_REASON")).toBeNull();
    expect(pauseReasonLabel("")).toBeNull();
    // Every category is label-bearing for the select control.
    for (const category of PAUSE_REASON_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
    }
  });

  it("composes the ops-internal cycle records with reason and dates (AC1/AC2)", () => {
    expect(
      pauseEventDetail({
        reasonLabel: "Medical leave",
        effectiveDateLabel: "July 20, 2026",
        note: "Expected back mid-August",
      }),
    ).toBe("Paused (Medical leave) effective July 20, 2026 — Expected back mid-August");
    expect(
      pauseEventDetail({
        reasonLabel: "Personal circumstances",
        effectiveDateLabel: "July 20, 2026",
        note: null,
      }),
    ).toBe("Paused (Personal circumstances) effective July 20, 2026");
    expect(resumeEventDetail({ effectiveDateLabel: "August 3, 2026" })).toBe(
      "Resumed effective August 3, 2026",
    );
  });
});

describe("terminal outcomes (Story 5.8; ADR-018)", () => {
  it("defines the four endings under two permissions, each admitted from Active and Paused only", () => {
    expect(TERMINAL_OUTCOMES.map((outcome) => outcome.status)).toEqual([
      PlacementStatus.COMPLETED,
      PlacementStatus.CONVERTED_TO_PERMANENT,
      PlacementStatus.WITHDRAWN,
      PlacementStatus.TERMINATED,
    ]);
    expect(
      TERMINAL_OUTCOMES.find((o) => o.status === PlacementStatus.TERMINATED)!.permission,
    ).toBe("placement.terminate");
    for (const outcome of TERMINAL_OUTCOMES) {
      expect(() =>
        assertPlacementTransition(PlacementStatus.ACTIVE, outcome.status),
      ).not.toThrow();
      expect(() =>
        assertPlacementTransition(PlacementStatus.PAUSED, outcome.status),
      ).not.toThrow();
      expect(() =>
        assertPlacementTransition(PlacementStatus.ONBOARDING, outcome.status),
      ).toThrow(/cannot move/);
      // Terminal states transition nowhere, ever — no reopening (AC4).
      expect(ALLOWED_PLACEMENT_TRANSITIONS[outcome.status]).toEqual([]);
    }
  });

  it("labels every ADR-018 termination reason category", () => {
    expect(TERMINATION_REASON_CATEGORIES.map((c) => c.label)).toEqual([
      "Safety concern",
      "Conduct or policy violation",
      "Sustained non-attendance",
      "Other",
    ]);
    expect(terminationReasonLabel("SAFETY_CONCERN")).toBe("Safety concern");
    expect(terminationReasonLabel("NOT_A_REASON")).toBeNull();
  });

  it("composes the ops-internal ending records per outcome (AC6)", () => {
    expect(
      terminalEventDetail({
        status: PlacementStatus.COMPLETED,
        effectiveDateLabel: "September 30, 2026",
        note: null,
      }),
    ).toBe("Completed effective September 30, 2026");
    expect(
      terminalEventDetail({
        status: PlacementStatus.CONVERTED_TO_PERMANENT,
        effectiveDateLabel: "September 30, 2026",
        employerName: "Harbor Haven Shelter",
        note: "Full-time kennel technician",
      }),
    ).toBe(
      "Converted to permanent employment — hired by Harbor Haven Shelter effective September 30, 2026 — Full-time kennel technician",
    );
    expect(
      terminalEventDetail({
        status: PlacementStatus.WITHDRAWN,
        effectiveDateLabel: "September 1, 2026",
        note: "Moving out of the area",
      }),
    ).toBe("Withdrawn effective September 1, 2026 — Moving out of the area");
    expect(
      terminalEventDetail({
        status: PlacementStatus.TERMINATED,
        effectiveDateLabel: "September 1, 2026",
        reasonLabel: "Safety concern",
        note: "Repeated unsafe animal handling after coaching",
      }),
    ).toBe(
      "Terminated (Safety concern) effective September 1, 2026 — Repeated unsafe animal handling after coaching",
    );
  });
});
