import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_TAB_LABELS } from "@/server/services/placement-service";
import { WorkspaceTabNav } from "./workspace-tab-nav";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("WorkspaceTabNav (Story 5.1)", () => {
  const tabs = ["overview", "schedule", "history"] as const;

  it("renders an accessible tablist with the active tab selected", () => {
    render(
      <WorkspaceTabNav
        tabs={[...tabs]}
        labels={WORKSPACE_TAB_LABELS}
        activeTab="overview"
        basePath="/operations/placements/records/p1"
      />,
    );

    expect(screen.getByRole("tablist", { name: "Placement detail" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Schedule" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // Roving tabindex: only the active tab is in the tab order.
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection with arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceTabNav
        tabs={[...tabs]}
        labels={WORKSPACE_TAB_LABELS}
        activeTab="overview"
        basePath="/x"
      />,
    );

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(push).toHaveBeenCalledWith("/x?tab=schedule", { scroll: false });

    await user.keyboard("{ArrowLeft}");
    expect(push).toHaveBeenCalledWith("/x?tab=overview", { scroll: false });
  });
});
