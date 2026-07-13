import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CompatibilityResult } from "@/server/domain/compatibility";
import { CompatibilityPanel } from "./compatibility-panel";

function result(
  category: CompatibilityResult["category"],
  categoryLabel: string,
  factors: CompatibilityResult["factors"],
): CompatibilityResult {
  return { category, categoryLabel, factors };
}

describe("CompatibilityPanel (Story 4.2; ADR-011)", () => {
  it.each([
    ["COMPATIBLE", "Compatible"],
    ["POTENTIAL_CONCERN", "Potential concern"],
    ["BLOCKING_INCOMPATIBILITY", "Blocking incompatibility"],
    ["UNKNOWN_NEEDS_REVIEW", "Unknown / needs review"],
  ] as const)("renders %s as text with an icon, never color alone (AC6)", (category, label) => {
    render(
      <CompatibilityPanel
        result={result(category, label, [
          { key: "capacity", label: "Shelter capacity", status: "CLEAR", detail: "Fine." },
        ])}
      />,
    );

    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  });

  it("lists each factor with its status word and plain-language detail", () => {
    render(
      <CompatibilityPanel
        result={result("BLOCKING_INCOMPATIBILITY", "Blocking incompatibility", [
          {
            key: "certifications",
            label: "Required certifications",
            status: "BLOCKING",
            detail: "Missing or expired: Pet CPR.",
          },
          {
            key: "schedule",
            label: "Proposed schedule",
            status: "UNKNOWN",
            detail: "Not yet proposed — set on the match draft (4.3).",
          },
        ])}
      />,
    );

    const list = screen.getByRole("list", { name: "Compatibility factors" });
    expect(list).toBeInTheDocument();
    expect(
      screen.getByText(/Required certifications — Blocking:/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing or expired: Pet CPR/)).toBeInTheDocument();
    expect(screen.getByText(/Proposed schedule — Unknown:/)).toBeInTheDocument();
  });

  it("renders the restriction factor without any narrative (AC5)", () => {
    render(
      <CompatibilityPanel
        result={result("POTENTIAL_CONCERN", "Potential concern", [
          {
            key: "restriction",
            label: "Placement restriction",
            status: "CONCERN",
            detail:
              "An approved placement restriction applies to this participant. Review it before proposing — the underlying detail stays restricted and is never shown here or to shelters.",
          },
        ])}
      />,
    );

    expect(screen.getByText(/stays restricted/)).toBeInTheDocument();
    expect(screen.queryByText(/conviction|offense|background report/i)).not.toBeInTheDocument();
  });

  it("shows no numeric score anywhere and states the advisory rule", () => {
    const { container } = render(
      <CompatibilityPanel
        result={result("COMPATIBLE", "Compatible", [
          { key: "capacity", label: "Shelter capacity", status: "CLEAR", detail: "Capacity available." },
        ])}
      />,
    );

    expect(container.textContent).not.toMatch(/\b\d{1,3}%|score of|\brating\b/i);
    expect(screen.getByText(/the coordinator makes the decision/i)).toBeInTheDocument();
  });
});
