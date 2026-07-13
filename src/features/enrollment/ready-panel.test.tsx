import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReadyPanel } from "./ready-panel";

describe("ReadyPanel (Story 3.7 Status Transition Control)", () => {
  it("is disabled — not hidden — with a text explanation while blockers remain", () => {
    render(<ReadyPanel enrollmentId="enr_1" ready={false} alreadyReady={false} />);

    const button = screen.getByRole("button", { name: "Mark Ready for Matching" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "ready-hint");
    expect(
      screen.getByText("Resolve the outstanding requirements above first."),
    ).toBeInTheDocument();
  });

  it("enables the transition with affirming copy when the gate is clear", () => {
    render(<ReadyPanel enrollmentId="enr_1" ready={true} alreadyReady={false} />);

    expect(screen.getByRole("button", { name: "Mark Ready for Matching" })).toBeEnabled();
    expect(
      screen.getByText(/Every requirement is complete — this enrollment can move to matching/),
    ).toBeInTheDocument();
  });

  it("shows the completed transition instead of a control once ready", () => {
    render(<ReadyPanel enrollmentId="enr_1" ready={true} alreadyReady={true} />);

    expect(
      screen.getByText(/Marked ready for matching — visible to placement matching/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces the server's named blockers when a stale attempt is rejected", () => {
    render(
      <ReadyPanel
        enrollmentId="enr_1"
        ready={true}
        alreadyReady={false}
        initialState={{
          status: "error",
          formError:
            "This enrollment isn't ready for matching yet. Outstanding: Safety Credential.",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Outstanding: Safety Credential/);
  });
});
