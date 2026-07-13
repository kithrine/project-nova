import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TerminalOutcomePanel } from "./terminal-outcome-panel";

vi.mock("@/features/placement/actions", () => ({
  recordTerminalOutcomeAction: vi.fn(async () => ({ status: "saved" })),
}));

const reasonOptions = [
  { key: "SAFETY_CONCERN", label: "Safety concern" },
  { key: "OTHER", label: "Other" },
];

function renderPanel(canTerminate = true) {
  return render(
    <TerminalOutcomePanel
      placementId="pl_1"
      canTerminate={canTerminate}
      employerDefault="Harbor Haven Shelter"
      reasonOptions={reasonOptions}
    />,
  );
}

describe("TerminalOutcomePanel (Story 5.8)", () => {
  it("offers four distinct labeled actions — never a status dropdown", () => {
    renderPanel();
    for (const name of [
      "Mark Completed…",
      "Record Permanent Hire…",
      "Record Withdrawal…",
      "Terminate Placement…",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("withholds Terminate without placement.terminate, keeping the other three", () => {
    renderPanel(false);
    expect(screen.queryByRole("button", { name: "Terminate Placement…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark Completed…" })).toBeInTheDocument();
  });

  it("confirms completion with finality language and an effective date", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Mark Completed…" }));
    expect(
      screen.getByText(/final — completed placements are never reopened/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Effective date")).toBeInTheDocument();
    expect(screen.getByLabelText("Summary (optional)")).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Yes, Mark Completed" })).toBeInTheDocument();
  });

  it("requires employer for a permanent hire, prefilled with the host organization", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Record Permanent Hire…" }));
    expect(screen.getByText(/creates the Employment Outcome record/i)).toBeInTheDocument();
    const employer = screen.getByLabelText("Hired by");
    expect(employer).toBeRequired();
    expect(employer).toHaveValue("Harbor Haven Shelter");
  });

  it("requires the participant's stated reason for a withdrawal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Record Withdrawal…" }));
    expect(
      screen.getByLabelText("Participant's stated reason (required)"),
    ).toBeRequired();
  });

  it("requires a reason category and note to terminate (ADR-018)", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Terminate Placement…" }));
    expect(screen.getByRole("group", { name: "Reason category" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Safety concern" })).toBeRequired();
    expect(screen.getByLabelText("What happened (required)")).toBeRequired();
    expect(screen.getByText(/final and cannot be undone/i)).toBeInTheDocument();
    // Cancel returns to the four actions without recording anything.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Mark Completed…" })).toBeInTheDocument();
  });
});
