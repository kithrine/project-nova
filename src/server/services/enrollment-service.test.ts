import { describe, expect, it } from "vitest";

import { EnrollmentStatus, OnboardingTaskStatus } from "@/generated/prisma/client";
import {
  DEFAULT_PROGRAM_CODE,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONES,
  ONBOARDING_TASK_STATUS_LABELS,
  ONBOARDING_TASK_STATUS_TONES,
  participantCompletionBlockReason,
  reopenBlockReason,
  staffCompletionBlockReason,
  taskDataFromTemplate,
} from "./enrollment-service";

describe("enrollment service (Story 3.1)", () => {
  it("labels every enrollment status", () => {
    for (const status of Object.values(EnrollmentStatus)) {
      expect(ENROLLMENT_STATUS_LABELS[status], `missing label for ${status}`).toBeTruthy();
    }
  });

  it("assigns every enrollment and task status a badge tone", () => {
    for (const status of Object.values(EnrollmentStatus)) {
      expect(ENROLLMENT_STATUS_TONES[status], `missing tone for ${status}`).toBeTruthy();
    }
    for (const status of Object.values(OnboardingTaskStatus)) {
      expect(
        ONBOARDING_TASK_STATUS_TONES[status],
        `missing tone for ${status}`,
      ).toBeTruthy();
    }
  });

  it("resolves the default program by a stable code — never by guessing", () => {
    expect(DEFAULT_PROGRAM_CODE).toBe("NOVA-TE");
  });
});

describe("taskDataFromTemplate (Story 3.2)", () => {
  const template = {
    id: "tpl_1",
    title: "Attend orientation session",
    description: "Join the orientation.",
    required: true,
    participantCompletable: false,
    sortOrder: 3,
  };

  it("maps a catalog template to an enrollment-owned Not Started task", () => {
    expect(taskDataFromTemplate(template, "enr_1")).toEqual({
      enrollmentId: "enr_1",
      templateId: "tpl_1",
      title: "Attend orientation session",
      description: "Join the orientation.",
      required: true,
      participantCompletable: false,
      sortOrder: 3,
      status: OnboardingTaskStatus.NOT_STARTED,
    });
  });

  it("never sets a placement owner — enrollment is the single owning context here", () => {
    expect("placementId" in taskDataFromTemplate(template, "enr_1")).toBe(false);
  });
});

describe("participantCompletionBlockReason (Story 3.3 eligibility rules)", () => {
  it("allows a participant-completable task that is Not Started", () => {
    expect(
      participantCompletionBlockReason({
        participantCompletable: true,
        status: OnboardingTaskStatus.NOT_STARTED,
      }),
    ).toBeNull();
  });

  it("blocks staff-only tasks regardless of status", () => {
    for (const status of Object.values(OnboardingTaskStatus)) {
      expect(
        participantCompletionBlockReason({ participantCompletable: false, status }),
      ).toBe("staff-only");
    }
  });

  it("blocks an already-complete task", () => {
    expect(
      participantCompletionBlockReason({
        participantCompletable: true,
        status: OnboardingTaskStatus.COMPLETE,
      }),
    ).toBe("already-complete");
  });
});

describe("staff transition rules (Story 3.3)", () => {
  it("staff completion applies only to Not Started tasks", () => {
    expect(staffCompletionBlockReason(OnboardingTaskStatus.NOT_STARTED)).toBeNull();
    expect(staffCompletionBlockReason(OnboardingTaskStatus.COMPLETE)).toBeTruthy();
  });

  it("reopen applies only to Complete tasks", () => {
    expect(reopenBlockReason(OnboardingTaskStatus.COMPLETE)).toBeNull();
    expect(reopenBlockReason(OnboardingTaskStatus.NOT_STARTED)).toBeTruthy();
  });
});

describe("onboarding task status labels", () => {
  it("labels every status", () => {
    for (const status of Object.values(OnboardingTaskStatus)) {
      expect(
        ONBOARDING_TASK_STATUS_LABELS[status],
        `missing label for ${status}`,
      ).toBeTruthy();
    }
  });
});
