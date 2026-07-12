import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { JourneyStep } from "@/server/services/application-journey";
import { JourneyTimeline } from "./journey-timeline";

const steps: JourneyStep[] = [
  { key: "PREPARE", label: "Prepare", state: "done" },
  { key: "SUBMIT", label: "Submit", state: "done" },
  { key: "REVIEW", label: "Review", state: "current" },
  { key: "DECISION", label: "Decision", state: "upcoming" },
];

describe("JourneyTimeline (Story 2.6 signature component)", () => {
  it("renders the four simplified steps as an accessible ordered list", () => {
    render(<JourneyTimeline steps={steps} />);

    const list = screen.getByRole("list", { name: "Your application journey" });
    expect(list).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Prepare"),
      expect.stringContaining("Submit"),
      expect.stringContaining("Review"),
      expect.stringContaining("Decision"),
    ]);
  });

  it("marks exactly the current step with aria-current='step'", () => {
    render(<JourneyTimeline steps={steps} />);

    const items = screen.getAllByRole("listitem");
    const current = items.filter((i) => i.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Review");
  });

  it("conveys each state in text, never color alone", () => {
    render(<JourneyTimeline steps={steps} />);

    expect(screen.getByText(/Prepare/).textContent).toContain("completed");
    expect(screen.getByText(/Review/).textContent).toContain("current step");
    expect(screen.getByText(/Decision/).textContent).toContain("not started yet");
  });
});
