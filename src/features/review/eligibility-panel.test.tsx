import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DecisionFormState } from "./actions";
import { EligibilityPanel, type EligibilityReviewSummary } from "./eligibility-panel";

const noopAction = async (): Promise<DecisionFormState> => ({ status: "idle" });

const inProgress: EligibilityReviewSummary = {
  reviewerName: "Casey Coordinator",
  startedAtLabel: "July 12, 2026",
  outcomeLabel: null,
  rationale: null,
  decidedAtLabel: null,
};

function renderPanel(props: Partial<Parameters<typeof EligibilityPanel>[0]> = {}) {
  return render(
    <EligibilityPanel
      status="SUBMITTED"
      review={null}
      canDecide={true}
      beginAction={noopAction}
      recordAction={noopAction}
      {...props}
    />,
  );
}

describe("EligibilityPanel (Story 2.8, ADR-015)", () => {
  it("shows the ADR-015 rubric with Begin on a submitted application", () => {
    renderPanel();

    expect(screen.getByText("Eligibility rubric (ADR-015)")).toBeInTheDocument();
    expect(screen.getByText(/18 years of age or older/)).toBeInTheDocument();
    expect(
      screen.getByText(/Offense history is never part of eligibility/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Begin Eligibility Review" }),
    ).toBeEnabled();
  });

  it("requires outcome, rationale, and the rubric confirmation before recording", () => {
    renderPanel({ status: "ELIGIBILITY_REVIEW", review: inProgress });

    const record = screen.getByRole("button", { name: "Record Eligibility Outcome" });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Eligible — advances/ }));
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /ADR-015 rubric only/i }));
    expect(record).toBeEnabled();

    expect(screen.getByLabelText(/Rationale \(internal\)/)).toBeRequired();
  });

  it("frames Not Eligible as the shared rejection with the 30-day reapply note", () => {
    renderPanel({ status: "ELIGIBILITY_REVIEW", review: inProgress });

    expect(
      screen.getByRole("radio", { name: /reapply\s+30 days after the decision/i }),
    ).toBeInTheDocument();
  });

  it("shows a read-only summary once the outcome is recorded, marked internal-only", () => {
    renderPanel({
      status: "INTERVIEW",
      review: {
        ...inProgress,
        outcomeLabel: "Eligible",
        rationale: "Meets every rubric item.",
        decidedAtLabel: "July 12, 2026",
      },
    });

    expect(screen.getByText("Outcome: Eligible")).toBeInTheDocument();
    expect(
      screen.getByText(/never shown to the applicant or shelters/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders view-only text for a reviewer without the permission", () => {
    renderPanel({ status: "ELIGIBILITY_REVIEW", review: inProgress, canDecide: false });

    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
