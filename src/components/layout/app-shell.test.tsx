import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders the shelter navigation with available links and disabled future items", () => {
    render(
      <AppShell experience="shelter" userLabel="Casey Supervisor">
        <p>content</p>
      </AppShell>,
    );

    const navs = screen.getAllByRole("navigation", { name: "Shelter navigation" });
    expect(navs.length).toBeGreaterThan(0); // mobile disclosure + desktop sidebar

    const desktopNav = navs[navs.length - 1];
    expect(within(desktopNav).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/shelter",
    );
    // Timesheets went live with Story 6.5; Evaluations remains a
    // Disabled future entry, not a link.
    expect(
      within(desktopNav).getByRole("link", { name: /timesheets/i }),
    ).toHaveAttribute("href", "/shelter/timesheets");
    expect(within(desktopNav).queryByRole("link", { name: /evaluations/i })).toBeNull();
    expect(
      within(desktopNav).getByText("Evaluations").closest("[aria-disabled]"),
    ).not.toBeNull();
  });

  it("labels each experience's navigation landmark distinctly", () => {
    render(
      <AppShell experience="operations" userLabel="Jordan Coordinator">
        <p>content</p>
      </AppShell>,
    );
    expect(
      screen.getAllByRole("navigation", { name: "Nova Operations navigation" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Nova Operations")).toBeInTheDocument();
  });

  it("renders SVG icons as decorative (aria-hidden), with text as the accessible label", () => {
    const { container } = render(
      <AppShell experience="participant" userLabel="Sam Participant">
        <p>content</p>
      </AppShell>,
    );
    const svgs = container.querySelectorAll("nav svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("hosts page content inside the skip-link target", () => {
    render(
      <AppShell experience="participant" userLabel="Sam">
        <p>page content</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(within(main).getByText("page content")).toBeInTheDocument();
  });

  it("provides a mobile menu disclosure that is keyboard-operable by nature (details/summary)", () => {
    const { container } = render(
      <AppShell experience="shelter" userLabel="Casey">
        <p>content</p>
      </AppShell>,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toContain("Menu");
  });
});
