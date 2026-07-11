import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font requires the Next build pipeline; return a plain stand-in.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-display", className: "font-display" }),
}));

import PublicLayout from "../layout";
import HowItWorksPage from "./page";

function renderPage() {
  return render(<PublicLayout>{HowItWorksPage()}</PublicLayout>);
}

describe("How It Works page (Story 2.1)", () => {
  it("renders semantic landmarks: banner, nav, main, contentinfo", () => {
    renderPage();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Public" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("has one h1 and ordered section headings", () => {
    renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/good work/i);

    const h2Texts = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2Texts).toEqual([
      "What Project Nova is",
      "How the journey works",
      "What to expect",
      "Ready when you are.",
    ]);
  });

  it("presents exactly one primary call to action, verb-labeled, into account onboarding", () => {
    renderPage();
    const primary = screen.getAllByRole("link", { name: /start your application/i });
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveAttribute("href", "/sign-up");
  });

  it("describes the journey as an ordered list of six steps", () => {
    renderPage();
    const journey = screen.getByRole("heading", { name: "How the journey works" });
    const section = journey.closest("section");
    expect(section).not.toBeNull();
    const items = within(section as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0].textContent).toMatch(/start your application/i);
    expect(items[5].textContent).toMatch(/what's next/i);
  });

  it("states that eligibility is determined during review, with no guarantee", () => {
    renderPage();
    expect(
      screen.getByText(/eligibility is determined during the review process/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/isn[’']t a guarantee of acceptance/i)).toBeInTheDocument();
  });

  it("uses respectful language — no stigmatizing terms anywhere on the page", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    for (const banned of [/criminal/i, /felon/i, /inmate/i, /offender/i, /ex-con/i, /failed/i]) {
      expect(text).not.toMatch(banned);
    }
  });

  it("keeps all icons as decorative SVGs (no emojis)", () => {
    const { container } = renderPage();
    const svgs = container.querySelectorAll("main svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
