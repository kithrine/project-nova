import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DateSquare } from "@/components/ui/date-square";

describe("DateSquare", () => {
  const parts = { month: "Jul", day: "3", year: "2026", full: "July 3, 2026" };

  it("exposes the full date to assistive tech, once", () => {
    render(<DateSquare parts={parts} />);
    expect(screen.getByRole("img", { name: "July 3, 2026" })).toBeInTheDocument();
  });

  it("renders the month and day glyphs aria-hidden on the teal tile", () => {
    render(<DateSquare parts={parts} />);
    const tile = screen.getByRole("img", { name: "July 3, 2026" });
    expect(tile.className).toContain("bg-primary");
    expect(tile.className).toContain("text-primary-content");
    const [month, day] = Array.from(tile.children);
    expect(month).toHaveAttribute("aria-hidden", "true");
    expect(month).toHaveTextContent("Jul");
    expect(day).toHaveAttribute("aria-hidden", "true");
    expect(day).toHaveTextContent("3");
  });
});
