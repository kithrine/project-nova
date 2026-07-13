import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PackageReviewPanel } from "./package-review-panel";

describe("PackageReviewPanel (Story 5.2, AC4)", () => {
  it("offers approve and request-changes as distinct, confirmed actions", async () => {
    const user = userEvent.setup();
    render(<PackageReviewPanel placementId="pl_1" />);

    expect(screen.getByRole("button", { name: "Approve Package" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve Package" }));
    expect(screen.getByText("Approve this placement package?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(screen.getByRole("button", { name: "Approve Package" })).toBeInTheDocument();
  });

  it("requires the change-request note — a revision loop, never a dead end", async () => {
    const user = userEvent.setup();
    render(<PackageReviewPanel placementId="pl_1" />);

    await user.click(screen.getByRole("button", { name: "Request Changes" }));
    const note = screen.getByLabelText("Note for the coordinator (required)");
    expect(note).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Yes, Request Changes" }),
    ).toBeInTheDocument();
  });
});
