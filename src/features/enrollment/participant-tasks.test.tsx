import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingTaskStatus } from "@/generated/prisma/client";
import type { ParticipantOnboardingSummary } from "@/server/services/enrollment-service";
import { ParticipantTasks } from "./participant-tasks";

function summary(
  overrides: Partial<ParticipantOnboardingSummary> = {},
): ParticipantOnboardingSummary {
  return {
    enrollmentId: "enr_1",
    programName: "Transitional Employment Program",
    completeCount: 1,
    totalCount: 3,
    tasks: [
      {
        id: "t1",
        title: "Confirm your contact information",
        description: "Make sure we can reach you.",
        required: true,
        participantCompletable: true,
        status: OnboardingTaskStatus.NOT_STARTED,
        statusLabel: "Not started",
        completedAtLabel: null,
      },
      {
        id: "t2",
        title: "Verify identity documents",
        description: "Originals checked at the office.",
        required: true,
        participantCompletable: false,
        status: OnboardingTaskStatus.NOT_STARTED,
        statusLabel: "Not started",
        completedAtLabel: null,
      },
      {
        id: "t3",
        title: "Review the program handbook",
        description: "The plain-language guide.",
        required: true,
        participantCompletable: true,
        status: OnboardingTaskStatus.COMPLETE,
        statusLabel: "Complete",
        completedAtLabel: "July 12, 2026",
      },
    ],
    ...overrides,
  };
}

describe("ParticipantTasks (Story 3.3)", () => {
  it("announces live progress in plain, respectful language", () => {
    render(<ParticipantTasks summary={summary()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 3 complete · 2 to go — at your own pace.",
    );
  });

  it("gives each completable task a control named after the task itself", () => {
    render(<ParticipantTasks summary={summary()} />);

    expect(
      screen.getByRole("button", { name: "Mark Done: Confirm your contact information" }),
    ).toBeEnabled();
    // Completed tasks and staff-only tasks carry no completion control.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("explains staff-only tasks calmly — pending, never a broken control (AC2)", () => {
    render(<ParticipantTasks summary={summary()} />);

    expect(
      screen.getByText(/Nova staff will take care of this one — nothing is needed from you/),
    ).toBeInTheDocument();
  });

  it("gives every state a text status — actionable tasks included, never icon-only", () => {
    render(<ParticipantTasks summary={summary()} />);

    expect(
      screen.getByText(/Not started — you can do this one whenever you're ready/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Complete · July 12, 2026/)).toBeInTheDocument();
  });

  it("celebrates completion without judgmental phrasing", () => {
    render(
      <ParticipantTasks
        summary={summary({ completeCount: 3, totalCount: 3, tasks: [] })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "All 3 tasks are complete — wonderful.",
    );
  });
});
