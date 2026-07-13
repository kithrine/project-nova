import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PausePanel, ResumePanel } from "./pause-resume-panel";

vi.mock("@/features/placement/actions", () => ({
  pausePlacementAction: vi.fn(async () => ({ status: "saved" })),
  resumePlacementAction: vi.fn(async () => ({ status: "saved" })),
}));

const reasonOptions = [
  { key: "MEDICAL_LEAVE", label: "Medical leave" },
  { key: "SHELTER_CLOSURE", label: "Shelter closure or site disruption" },
];

describe("PausePanel (Story 5.7)", () => {
  it("opens a confirmation form requiring a reason category", async () => {
    const user = userEvent.setup();
    render(<PausePanel placementId="pl_1" reasonOptions={reasonOptions} />);

    await user.click(screen.getByRole("button", { name: "Pause Placement…" }));

    const reason = screen.getByLabelText("Reason (required)");
    expect(reason).toBeRequired();
    expect(
      screen.getByRole("option", { name: "Medical leave" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Shelter closure or site disruption" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Effective date")).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Yes, Pause Placement" }),
    ).toBeInTheDocument();
  });

  it("can be cancelled without acting", async () => {
    const user = userEvent.setup();
    render(<PausePanel placementId="pl_1" reasonOptions={reasonOptions} />);

    await user.click(screen.getByRole("button", { name: "Pause Placement…" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Pause Placement…" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Reason (required)")).toBeNull();
  });
});

describe("ResumePanel (Story 5.7)", () => {
  it("opens a confirmation form with the resume date", async () => {
    const user = userEvent.setup();
    render(<ResumePanel placementId="pl_1" />);

    expect(screen.getByText(/pause stays in History/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume Placement…" }));
    expect(screen.getByLabelText("Resume date")).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Yes, Resume Placement" }),
    ).toBeInTheDocument();
  });
});
