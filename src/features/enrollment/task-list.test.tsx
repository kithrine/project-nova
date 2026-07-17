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
    statusTone: "neutral",
    completedAtLabel: null,
    completedByName: null,
  },
  {
    id: "task_2",
    title: "Add an emergency contact",
    description: "Someone we can reach if anything comes up.",
    required: true,
    participantCompletable: true,
    status: OnboardingTaskStatus.COMPLETE,
    statusLabel: "Complete",
    statusTone: "success",
    completedAtLabel: "July 12, 2026",
    completedByName: "Casey Coordinator",
  },
];

const ops = { enrollmentId: "enr_1", canComplete: true, canReopen: true };

describe("TaskList (Stories 3.2/3.3)", () => {
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

  it("shows no transition controls without ops permissions", () => {
    render(<TaskList tasks={tasks} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names each staff control after its specific task — never a bare Complete (3.3)", () => {
    render(<TaskList tasks={tasks} ops={ops} />);

    expect(
      screen.getByRole("button", { name: "Complete: Attend orientation session" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Reopen: Add an emergency contact" }),
    ).toBeEnabled();
  });

  it("shows who completed a task and when in the ops view (3.3)", () => {
    render(<TaskList tasks={tasks} ops={ops} />);
    expect(
      screen.getByText("Completed July 12, 2026 by Casey Coordinator"),
    ).toBeInTheDocument();
  });

  it("respects granular permissions — view without complete or reopen", () => {
    render(
      <TaskList tasks={tasks} ops={{ ...ops, canComplete: false, canReopen: false }} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a calm empty state when no tasks exist", () => {
    render(<TaskList tasks={[]} />);
    expect(screen.getByText(/No onboarding tasks exist/)).toBeInTheDocument();
  });
});
