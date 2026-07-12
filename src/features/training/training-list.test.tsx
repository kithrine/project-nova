import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrainingEnrollmentStatus } from "@/generated/prisma/client";
import type { TrainingProgramView } from "@/server/services/training-service";
import { TrainingList } from "./training-list";

const programs: TrainingProgramView[] = [
  {
    id: "training_1",
    code: "WORKPLACE-READINESS",
    name: "Workplace Readiness and Communication",
    description: "Communication and workplace expectations.",
    requiredForMatching: true,
    attempts: [
      {
        id: "attempt_1",
        status: TrainingEnrollmentStatus.IN_PROGRESS,
        statusLabel: "In progress",
        enrolledAtLabel: "Jul 1, 2026",
        expectedCompletionDateLabel: "Jul 10, 2026",
        startedAtLabel: "Jul 2, 2026",
        completedAtLabel: null,
        withdrawnAtLabel: null,
        providerName: "Nova Learning Partner",
        completionMethodLabel: null,
      },
    ],
  },
  {
    id: "training_2",
    code: "ANIMAL-HANDLING-FOUNDATIONS",
    name: "Animal Behavior, Humane Handling, and Bite Prevention Foundations",
    description: "Animal body language and safe handling foundations.",
    requiredForMatching: true,
    attempts: [],
  },
];

describe("TrainingList (Story 3.4)", () => {
  it("renders required programs and status in text, not color alone", () => {
    render(
      <TrainingList
        enrollmentId="enr_1"
        programs={programs}
        canCreate={false}
        canUpdate={false}
        today="2026-07-12"
      />,
    );
    expect(screen.getByText("Workplace Readiness and Communication")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getAllByText("Required for matching")).toHaveLength(2);
    expect(screen.getByText("Not enrolled yet.")).toBeInTheDocument();
  });

  it("shows only explicit actions permitted by the current lifecycle", () => {
    render(
      <TrainingList
        enrollmentId="enr_1"
        programs={programs}
        canCreate={true}
        canUpdate={true}
        today="2026-07-12"
      />,
    );
    expect(screen.getByRole("button", { name: "Enroll participant" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Record completion" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Withdraw attempt" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Start training" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /status/i })).not.toBeInTheDocument();
  });

  it("hides all mutation controls without coordinator permissions", () => {
    render(
      <TrainingList
        enrollmentId="enr_1"
        programs={programs}
        canCreate={false}
        canUpdate={false}
        today="2026-07-12"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
