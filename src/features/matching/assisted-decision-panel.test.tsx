import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AssistedDecisionPanel } from "./assisted-decision-panel";

describe("AssistedDecisionPanel (Story 4.5, AC3)", () => {
  it("keeps recording disabled until a decision is chosen AND confirmed", async () => {
    const user = userEvent.setup();
    render(<AssistedDecisionPanel matchId="match_1" />);

    const submit = screen.getByRole("button", { name: "Record Participant Decision" });
    expect(submit).toBeDisabled();

    await user.click(
      screen.getByLabelText("The participant accepts this placement"),
    );
    expect(submit).toBeDisabled();

    await user.click(
      screen.getByLabelText(/I confirmed this decision with the participant/),
    );
    expect(submit).toBeEnabled();
  });

  it("frames the decision as the participant's own, with an Operations-only note", () => {
    render(<AssistedDecisionPanel matchId="match_1" />);

    expect(
      screen.getByText(/The decision stays theirs — you are recorded as having entered it/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Note \(optional — Operations-only, never shared with the shelter\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("The participant declines this placement"),
    ).toBeInTheDocument();
  });
});
