import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MatchingBlocker } from "@/server/domain/matching-readiness";
import { BlockerList } from "./blocker-list";

const blockers: MatchingBlocker[] = [
  {
    kind: "task",
    id: "t1",
    label: "Attend orientation session",
    detail: "Required onboarding task not complete",
    anchor: "#onboarding-tasks",
  },
  {
    kind: "training",
    id: "tp1",
    label: "Workplace Readiness and Communication",
    detail: "Required training has no completed attempt",
    anchor: "#training",
  },
  {
    kind: "certification",
    id: "c1",
    label: "Pet First Aid & CPR",
    detail: "Required certification has expired",
    anchor: "#certifications",
  },
];

describe("BlockerList (Story 3.6, AC4)", () => {
  it("names each blocker with its requirement and a navigable link", () => {
    render(<BlockerList blockers={blockers} />);

    expect(screen.getByRole("list", { name: "Outstanding requirements" })).toBeInTheDocument();
    expect(screen.getByText("Onboarding task: Attend orientation session")).toBeInTheDocument();
    expect(
      screen.getByText("Training: Workplace Readiness and Communication"),
    ).toBeInTheDocument();
    expect(screen.getByText("Certification: Pet First Aid & CPR")).toBeInTheDocument();
    expect(screen.getByText("Required certification has expired")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Go to onboarding tasks" })).toHaveAttribute(
      "href",
      "#onboarding-tasks",
    );
    expect(screen.getByRole("link", { name: "Go to trainings" })).toHaveAttribute(
      "href",
      "#training",
    );
    expect(screen.getByRole("link", { name: "Go to certifications" })).toHaveAttribute(
      "href",
      "#certifications",
    );
  });

  it("renders the explicit ready state — never a blank panel", () => {
    render(<BlockerList blockers={[]} />);
    expect(
      screen.getByText(/No outstanding requirements — this enrollment is ready for matching/),
    ).toBeInTheDocument();
  });
});
