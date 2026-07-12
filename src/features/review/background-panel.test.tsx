import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DecisionFormState } from "./actions";
import { BackgroundPanel } from "./background-panel";

const noopAction = async (): Promise<DecisionFormState> => ({ status: "idle" });

function renderPanel(props: Partial<Parameters<typeof BackgroundPanel>[0]> = {}) {
  return render(
    <BackgroundPanel
      status="BACKGROUND_REVIEW"
      review={null}
      canDecide={true}
      recordAction={noopAction}
      {...props}
    />,
  );
}

describe("BackgroundPanel (Story 2.10)", () => {
  it("requires outcome, rationale, and confirmation before recording", () => {
    renderPanel();

    const record = screen.getByRole("button", { name: "Record Background Decision" });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Clear — the application/ }));
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /final and audited/i }));
    expect(record).toBeEnabled();
    expect(screen.getByLabelText("Restricted rationale")).toBeRequired();
  });

  it("reveals the ADR-016 category choice only for a Disqualifying outcome", () => {
    renderPanel();

    expect(screen.queryByText(/Rejection category \(ADR-016\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Disqualifying — invokes/ }));

    expect(screen.getByText(/Rejection category \(ADR-016\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /ordinary rejection.*30 days/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /PERMANENT court-ordered animal-possession ban/ }),
    ).toBeInTheDocument();
  });

  it("shows the recorded outcome with its restricted rationale", () => {
    renderPanel({
      status: "ACCEPTED",
      review: {
        reviewerName: "Riley Specialist",
        outcomeLabel: "Clear",
        rationale: "External check complete; no job-related concerns.",
        recordedAtLabel: "July 12, 2026",
      },
    });

    expect(screen.getByText("Outcome: Clear")).toBeInTheDocument();
    expect(screen.getByText(/visible only here, never logged/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing actionable without the decide permission", () => {
    renderPanel({ canDecide: false });

    expect(screen.getByText(/No background review has been recorded/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
