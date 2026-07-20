import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { PublicNav } from "./public-nav";

let mockPathname = "/";

describe("PublicNav (mobile nav pass)", () => {
  beforeEach(() => {
    mockPathname = "/";
  });
  it("keeps one copy of every link in the DOM while closed (class-hidden, not removed)", () => {
    render(<PublicNav />);

    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).toHaveClass("hidden");

    // Pins the singular-query contract the page suites rely on: the links
    // must stay role-queryable while the panel is closed (class-hidden
    // only — never conditionally rendered, never aria-hidden).
    expect(screen.getByRole("link", { name: "Apply Now" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("toggles the panel and aria-expanded on click", async () => {
    const user = userEvent.setup();
    render(<PublicNav />);

    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).not.toHaveClass("hidden");
    expect(panel).toHaveClass("flex");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveClass("hidden");
  });

  it("closes on Escape and returns focus to the menu button", async () => {
    const user = userEvent.setup();
    render(<PublicNav />);

    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes when a navigation link is activated", async () => {
    const user = userEvent.setup();
    render(<PublicNav />);

    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);

    await user.click(screen.getByRole("link", { name: "Log In" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the route changes underneath it (brand link, back/forward)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PublicNav />);

    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    mockPathname = "/how-it-works";
    rerender(<PublicNav />);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when focus leaves the disclosure instead of lingering over content", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PublicNav />
        <a href="#after">After the nav</a>
      </>,
    );

    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    // Tab from the last panel link out into the page beneath the sheet.
    screen.getByRole("link", { name: "Apply Now" }).focus();
    await user.tab();
    expect(screen.getByRole("link", { name: "After the nav" })).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
