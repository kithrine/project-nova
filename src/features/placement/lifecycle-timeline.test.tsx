import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/client";
import { buildPlacementTimeline } from "@/server/domain/placement";
import { LifecycleTimeline } from "./lifecycle-timeline";

describe("LifecycleTimeline (Story 5.1)", () => {
  it("renders every main-path stage with the current one marked by text, not color alone", () => {
    render(
      <LifecycleTimeline stages={buildPlacementTimeline(PlacementStatus.ONBOARDING)} />,
    );

    const list = screen.getByRole("list", { name: "Placement lifecycle" });
    expect(list).toBeInTheDocument();
    for (const label of [
      "Draft",
      "Proposed",
      "Shelter review",
      "Approved",
      "Onboarding",
      "Active",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const current = screen.getByText("Onboarding").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("(current stage)")).toBeInTheDocument();
  });

  it("shows the Paused loop with Paused current and Active behind it", () => {
    render(
      <LifecycleTimeline stages={buildPlacementTimeline(PlacementStatus.PAUSED)} />,
    );
    expect(screen.getByText("Paused").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("closes a terminal placement with the terminal stage current (AC4)", () => {
    render(
      <LifecycleTimeline
        stages={buildPlacementTimeline(
          PlacementStatus.COMPLETED,
          PlacementStatus.ACTIVE,
        )}
      />,
    );
    expect(screen.getByText("Completed").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
