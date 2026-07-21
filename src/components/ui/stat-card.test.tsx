import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "./stat-card";

const icon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
    <circle cx="12" cy="12" r="9" />
  </svg>
);

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Onboarding tasks" value="3/5" icon={icon} tone="primary" />);
    expect(screen.getByText("Onboarding tasks")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("renders the sublabel as a link when href is given", () => {
    render(
      <StatCard
        label="Timesheets awaiting review"
        value={4}
        sublabel="Open the queue"
        href="/shelter/timesheets"
        icon={icon}
        tone="warning"
      />,
    );
    const link = screen.getByRole("link", { name: "Open the queue" });
    expect(link).toHaveAttribute("href", "/shelter/timesheets");
  });

  it("renders a plain sublabel without href and keeps the icon decorative", () => {
    const { container } = render(
      <StatCard label="Program" value="NOVA-TE" sublabel="Transitional employment" icon={icon} tone="accent" />,
    );
    expect(screen.getByText("Transitional employment")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("steps phrase-length string values down from the KPI size so they stay inside the tile", () => {
    render(
      <StatCard
        label="Program"
        value="Transitional Employment Program"
        sublabel="Enrolled"
        icon={icon}
        tone="accent"
      />,
    );
    const value = screen.getByText("Transitional Employment Program");
    expect(value).toBeInTheDocument();
    expect(value).toHaveClass("text-xl");
    expect(value).not.toHaveClass("text-3xl");
    // Short KPI values keep the big treatment.
    render(<StatCard label="Hours" value="12.50" icon={icon} tone="primary" />);
    expect(screen.getByText("12.50")).toHaveClass("text-3xl");
  });
});
