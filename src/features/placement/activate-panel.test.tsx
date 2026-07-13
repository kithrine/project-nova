import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivatePanel } from "./activate-panel";

vi.mock("@/features/placement/actions", () => ({
  activatePlacementAction: vi.fn(async () => ({ status: "saved" })),
}));

describe("ActivatePanel (Story 5.6)", () => {
  it("stays disabled — not hidden — and names each blocker while any remain", () => {
    render(
      <ActivatePanel
        placementId="pl_1"
        blockers={["Active funding assignment", "Schedule confirmed"]}
      />,
    );

    const button = screen.getByRole("button", { name: "Activate Placement" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Activation is waiting on:")).toBeInTheDocument();
    expect(screen.getByText("Active funding assignment")).toBeInTheDocument();
    expect(screen.getByText("Schedule confirmed")).toBeInTheDocument();
    // No confirmation offered while blocked.
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("requires the explicit confirmation before the action arms (AC1)", async () => {
    const user = userEvent.setup();
    render(<ActivatePanel placementId="pl_1" blockers={[]} />);

    const button = screen.getByRole("button", { name: "Activate Placement" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/Every activation prerequisite is met/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
  });
});
