import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubmitTimesheetPanel } from "./submit-timesheet-panel";

vi.mock("@/features/timesheets/actions", () => ({
  submitTimesheetAction: vi.fn(async () => ({ status: "saved" })),
}));

describe("SubmitTimesheetPanel (Story 6.4)", () => {
  it("shows Submit disabled WITH its reason until an entry exists", () => {
    render(
      <SubmitTimesheetPanel
        timesheetId="ts_1"
        disabledReason="Add at least one work day before submitting."
      />,
    );

    expect(screen.getByRole("button", { name: "Submit Hours" })).toBeDisabled();
    expect(
      screen.getByText("Add at least one work day before submitting."),
    ).toBeInTheDocument();
  });

  it("arms through a confirmation step that names the consequence", async () => {
    const user = userEvent.setup();
    render(<SubmitTimesheetPanel timesheetId="ts_1" disabledReason={null} />);

    await user.click(screen.getByRole("button", { name: "Submit Hours…" }));
    expect(
      screen.getByText(/won't be able to edit your hours while your supervisor reviews/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, Submit Hours" })).toBeInTheDocument();

    // Cancel returns to the armed state without submitting.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Submit Hours…" })).toBeInTheDocument();
  });
});
