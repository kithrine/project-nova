import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Lora: () => ({ variable: "--font-display", className: "font-display" }),
  Caveat: () => ({ variable: "--font-script", className: "font-script" }),
}));

import PublicLayout from "./layout";
import HomePage from "./page";

/**
 * Homepage (brand refresh) — rendered inside the public layout so the
 * header/footer participate in every assertion, mirroring the
 * how-it-works suite: landmarks, one h1, exactly ONE
 * "Start Your Application" link per page (the header's CTA is "Apply
 * Now" for exactly this reason), respectful language, SVG-only icons.
 */
function renderHomePage() {
  return render(
    <PublicLayout>
      <HomePage />
    </PublicLayout>,
  );
}

describe("HomePage", () => {
  it("renders the landmark structure", () => {
    renderHomePage();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Public" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("has exactly one h1 — the mockup hero headline", () => {
    renderHomePage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toMatch(/stronger futures start with\s*opportunity\./i);
  });

  it("offers exactly one Start Your Application link, into sign-up", () => {
    renderHomePage();
    const applicationLinks = screen.getAllByRole("link", {
      name: /start your application/i,
    });
    expect(applicationLinks).toHaveLength(1);
    expect(applicationLinks[0]).toHaveAttribute("href", "/sign-up");

    // The header CTA keeps its distinct name and target.
    const applyNow = screen.getByRole("link", { name: "Apply Now" });
    expect(applyNow).toHaveAttribute("href", "/sign-up");
  });

  it("links See How It Works to the journey page", () => {
    renderHomePage();
    const links = screen.getAllByRole("link", { name: /see how it works/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/how-it-works");
  });

  it("reframes the trust strip with categories, never fictional organizations", () => {
    renderHomePage();
    const strip = screen.getByRole("heading", {
      name: /built for shelters and workforce programs/i,
    }).parentElement as HTMLElement;
    const items = within(strip).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Animal Shelters",
      "Workforce Boards",
      "Reentry Programs",
      "Community Nonprofits",
    ]);
  });

  it("renders the four value propositions", () => {
    renderHomePage();
    for (const title of [
      "Participant-Centered",
      "Shelter Partnerships",
      "Workflow-Driven",
      "Data That Drives Change",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
  });

  /* COMMENTED OUT 2026-07-18 alongside the DashboardIllustration mockup it
     pins (swapped for the photographic hero; both kept for potential return).
  it("keeps the decorative dashboard illustration out of the accessibility tree", () => {
    const { container } = renderHomePage();
    // The fictional coordinator vignette renders but is aria-hidden with
    // nothing focusable inside it.
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]'));
    const dashboard = hidden.find((node) => node.textContent?.includes("Jordan"));
    expect(dashboard).toBeDefined();
    expect(dashboard?.querySelectorAll("a, button, input, select, textarea")).toHaveLength(0);
  });
  */

  it("renders the photographic hero as decorative (empty alt)", () => {
    const { container } = renderHomePage();
    // Several decorative images exist (brand logos, band lockup) — find
    // the hero photo among them and assert its decorative stance.
    const decorativeImages = Array.from(container.querySelectorAll('img[alt=""]'));
    const hero = decorativeImages.find((img) =>
      img.getAttribute("src")?.includes("nova-homepage-hero"),
    );
    expect(hero).toBeDefined();
  });

  it("uses respectful, person-first language everywhere", () => {
    const { container } = renderHomePage();
    const text = container.textContent ?? "";
    for (const banned of [/criminal/i, /felon/i, /inmate/i, /offender/i, /ex-con/i, /failed/i]) {
      expect(text).not.toMatch(banned);
    }
  });

  it("keeps every SVG decorative (aria-hidden) — no emoji iconography", () => {
    const { container } = renderHomePage();
    const main = container.querySelector("main") as HTMLElement;
    const svgs = Array.from(main.querySelectorAll("svg"));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
