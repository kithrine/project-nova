import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it.each([
    ["accent", "bg-accent/20"],
    ["success", "text-success"],
    ["warning", "text-warning"],
    ["error", "text-error"],
    ["info", "text-info"],
    ["neutral", "bg-base-200"],
  ] as const)("renders the %s tone", (tone, expectedClass) => {
    render(<Badge tone={tone}>Chip text</Badge>);
    const badge = screen.getByText("Chip text");
    expect(badge.className).toContain(expectedClass);
  });

  it("carries its meaning as text, never color alone", () => {
    render(<Badge tone="warning">Awaiting review</Badge>);
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
  });
});
