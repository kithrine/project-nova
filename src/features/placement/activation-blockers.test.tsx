import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivationView } from "@/server/services/placement-service";
import { ActivationBlockers } from "./activation-blockers";

const openView: ActivationView = {
  open: [
    {
      key: "funding",
      title: "Active funding assignment",
      action: "Assign a funding source.",
      href: "/operations/placements/records/pl_1?tab=funding",
    },
    {
      key: "siteOnboarding",
      title: "Host-site safety orientation and assigned-task competency confirmed",
      action: "Complete the remaining site onboarding steps.",
      href: "/operations/placements/records/pl_1#placement-onboarding",
    },
  ],
};

describe("ActivationBlockers (Story 5.5)", () => {
  it("lists each unmet prerequisite by its documented name with a resolving link", () => {
    render(<ActivationBlockers activation={openView} />);

    const list = screen.getByRole("list", { name: "Activation blockers" });
    expect(list).toBeInTheDocument();
    expect(screen.getByText("Open — Active funding assignment")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Open — Host-site safety orientation and assigned-task competency confirmed",
      ),
    ).toBeInTheDocument();

    // Each action is a keyboard-actionable link to the resolving surface.
    const fundingLink = screen.getByRole("link", { name: "Assign a funding source." });
    expect(fundingLink).toHaveAttribute(
      "href",
      "/operations/placements/records/pl_1?tab=funding",
    );
    expect(
      screen.getByRole("link", { name: "Complete the remaining site onboarding steps." }),
    ).toHaveAttribute("href", "/operations/placements/records/pl_1#placement-onboarding");
  });

  it("severity is carried by text, never color alone", () => {
    render(<ActivationBlockers activation={openView} />);
    // The word "Open" appears on every item; the icon is aria-hidden.
    expect(screen.getAllByText(/^Open — /)).toHaveLength(2);
  });

  it("announces the all-clear state when nothing blocks activation (AC2)", () => {
    render(<ActivationBlockers activation={{ open: [] }} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "All activation prerequisites are met.",
    );
    expect(screen.queryByRole("list", { name: "Activation blockers" })).toBeNull();
  });
});
