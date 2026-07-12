import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingTaskStatus } from "@/generated/prisma/client";
import type { OnboardingTaskView } from "@/server/services/enrollment-service";
import { TaskList } from "./task-list";

const tasks: OnboardingTaskView[] = [
  {
    id: "task_1",
    title: "Attend orientation session",
    description: "Join the Project Nova orientation and meet your coordinator.",
    required: true,
    participantCompletable: false,
    status: OnboardingTaskStatus.NOT_STARTED,
    statusLabel: "Not started",
  },
  {
    id: "task_2",
    title: "Add an emergency contact",
    description: "Someone we can reach if anything comes up.",
    required: true,
    participantCompletable: true,
    status: OnboardingTaskStatus.COMPLETE,
    statusLabel: "Complete",
  },
];

describe("TaskList (Story 3.2)", () => {
  it("renders every task with status as text, never color alone", () => {
    render(<TaskList tasks={tasks} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Attend orientation session")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("spells out required and who can complete each task", () => {
    render(<TaskList tasks={tasks} />);

    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(screen.getByText("Recorded by Nova staff")).toBeInTheDocument();
    expect(screen.getByText("Participant can complete")).toBeInTheDocument();
  });

  it("shows a calm empty state when no tasks exist", () => {
    render(<TaskList tasks={[]} />);
    expect(screen.getByText(/No onboarding tasks exist/)).toBeInTheDocument();
  });
});
