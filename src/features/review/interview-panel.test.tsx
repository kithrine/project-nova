import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DecisionFormState } from "./actions";
import { InterviewPanel, type InterviewSummary } from "./interview-panel";

const noopAction = async (): Promise<DecisionFormState> => ({ status: "idle" });

const scheduled: InterviewSummary = {
  id: "int_1",
  scheduledAtLabel: "August 1, 2026 at 10:30 AM",
  formatLabel: "In person",
  interviewerName: "Casey Coordinator",
  outcomeLabel: null,
  notes: null,
  isCurrent: true,
};

function renderPanel(props: Partial<Parameters<typeof InterviewPanel>[0]> = {}) {
  return render(
    <InterviewPanel
      status="INTERVIEW"
      interviews={[]}
      canSchedule={true}
      canRecord={true}
      scheduleAction={noopAction}
      recordAction={noopAction}
      {...props}
    />,
  );
}

describe("InterviewPanel (Story 2.9)", () => {
  it("offers a standard date/time input and format select for scheduling", () => {
    renderPanel();

    expect(screen.getByLabelText("Date and time")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("Format")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule Interview" })).toBeEnabled();
  });

  it("labels a scheduled appointment distinctly", () => {
    renderPanel({ interviews: [scheduled] });
    expect(screen.getByText("Scheduled interview")).toBeInTheDocument();
    expect(screen.queryByText("Interview — outcome recorded")).not.toBeInTheDocument();
  });

  it("labels a recorded outcome distinctly, with internal-only notes", () => {
    renderPanel({
      status: "BACKGROUND_REVIEW",
      interviews: [{ ...scheduled, outcomeLabel: "Advance", notes: "Strong fit." }],
    });
    expect(screen.getByText("Interview — outcome recorded")).toBeInTheDocument();
    expect(screen.getByText("Outcome: Advance")).toBeInTheDocument();
    expect(
      screen.getByText(/never shown to the applicant or shelters/i),
    ).toBeInTheDocument();
  });

  it("reschedule preserves history — prior times listed, never overwritten", () => {
    renderPanel({
      interviews: [
        scheduled,
        {
          ...scheduled,
          id: "int_0",
          scheduledAtLabel: "July 25, 2026 at 2:00 PM",
          isCurrent: false,
        },
      ],
    });

    expect(screen.getByText("Earlier scheduled times")).toBeInTheDocument();
    expect(screen.getByText(/July 25, 2026 at 2:00 PM.*rescheduled/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule…" })).toBeInTheDocument();
  });

  it("requires outcome, notes, and confirmation before recording", () => {
    renderPanel({ interviews: [scheduled] });

    const record = screen.getByRole("button", { name: "Record Interview Outcome" });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Advance — moves/ }));
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /ready to record/i }));
    expect(record).toBeEnabled();
    expect(screen.getByLabelText("Internal notes")).toBeRequired();
  });

  it("frames Do Not Advance as the shared rejection with the 30-day note", () => {
    renderPanel({ interviews: [scheduled] });
    expect(
      screen.getByRole("radio", { name: /reapply\s+30 days after the decision/i }),
    ).toBeInTheDocument();
  });

  it("shows read-only content without scheduling controls when not permitted", () => {
    renderPanel({ interviews: [scheduled], canSchedule: false, canRecord: false });

    expect(screen.getByText("Scheduled interview")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
