import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RevisePanel } from "./revise-panel";

describe("RevisePanel (Story 4.7)", () => {
  it("names the missing core fields and stays disabled — never hidden", () => {
    render(
      <RevisePanel matchId="match_1" missingFields={["Candidate supervisor"]} />,
    );

    expect(
      screen.getByText("Complete these first: Candidate supervisor."),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Re-propose Match" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "repropose-hint");
  });

  it("explains the fresh-consent reset when the revision is complete", () => {
    render(<RevisePanel matchId="match_1" missingFields={[]} />);

    expect(
      screen.getByText(/both review it fresh, with new decision windows/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-propose Match" })).toBeEnabled();
  });
});
