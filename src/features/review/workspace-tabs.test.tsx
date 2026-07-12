import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Restricted } from "@/components/feedback/restricted";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { WorkspaceTabs, type WorkspaceTabItem } from "./workspace-tabs";

const tabs: WorkspaceTabItem[] = [
  { key: "overview", label: "Overview", href: "?tab=overview", selected: true },
  { key: "documents", label: "Documents", href: "?tab=documents", selected: false },
  { key: "background", label: "Background", href: "?tab=background", selected: false },
];

describe("WorkspaceTabs (Story 2.7 accessible tabs)", () => {
  it("renders ARIA tab roles with a single selected tab", () => {
    render(<WorkspaceTabs tabs={tabs} />);

    expect(screen.getByRole("tablist", { name: "Application workspace sections" })).toBeInTheDocument();
    const rendered = screen.getAllByRole("tab");
    expect(rendered).toHaveLength(3);
    expect(rendered.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  it("uses roving tabindex — only the selected tab is in the tab order", () => {
    render(<WorkspaceTabs tabs={tabs} />);

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Background" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus with arrow keys, wrapping at the ends", () => {
    render(<WorkspaceTabs tabs={tabs} />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    const documents = screen.getByRole("tab", { name: "Documents" });
    const background = screen.getByRole("tab", { name: "Background" });

    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(documents).toHaveFocus();

    fireEvent.keyDown(documents, { key: "ArrowLeft" });
    expect(overview).toHaveFocus();

    fireEvent.keyDown(overview, { key: "ArrowLeft" }); // wraps to the end
    expect(background).toHaveFocus();

    fireEvent.keyDown(background, { key: "Home" });
    expect(overview).toHaveFocus();
  });

  it("every tab targets the single workspace panel", () => {
    render(<WorkspaceTabs tabs={tabs} />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-controls", "workspace-panel");
    }
  });
});

describe("Restricted vs Permission denied (distinct states, no color needed)", () => {
  it("Restricted is a calm inline panel — not an alert — with its own wording", () => {
    render(<Restricted />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Restricted content")).toBeInTheDocument();
    expect(screen.getByText(/audited/i)).toBeInTheDocument();
  });

  it("Permission denied is an alert with different wording — the two are distinguishable by text alone", () => {
    render(<PermissionDenied />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
    expect(screen.queryByText("Restricted content")).not.toBeInTheDocument();
  });
});
