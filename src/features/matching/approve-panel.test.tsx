import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApprovePanel } from "./approve-panel";

describe("ApprovePanel (Story 4.8)", () => {
  it("names every outstanding prerequisite and keeps Approve disabled — never hidden (AC2)", () => {
    render(
      <ApprovePanel
        matchId="match_1"
        blockers={[
          "Waiting on the participant's acceptance.",
          "Waiting on the shelter's approval.",
        ]}
      />,
    );

    expect(screen.getByText("Approval is waiting on:")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting on the participant's acceptance."),
    ).toBeInTheDocument();
    expect(screen.getByText("Waiting on the shelter's approval.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Match" })).toBeDisabled();
  });

  it("requires the explicit human confirmation even when eligible (ADR-011)", async () => {
    const user = userEvent.setup();
    render(<ApprovePanel matchId="match_1" blockers={[]} />);

    expect(
      screen.getByText(/The participant accepted and the shelter approved/),
    ).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve Match" });
    expect(approve).toBeDisabled();

    await user.click(
      screen.getByLabelText(/this creates the placement and can't be undone/),
    );
    expect(approve).toBeEnabled();
  });
});
