import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PermissionDenied } from "./permission-denied";

describe("PermissionDenied", () => {
  it("renders as an alert with an accessible heading and respectful copy", () => {
    render(<PermissionDenied />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/contact your project nova coordinator/i)).toBeInTheDocument();
  });

  it("hides the decorative icon from assistive technology", () => {
    const { container } = render(<PermissionDenied />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("supports custom, context-specific copy", () => {
    render(<PermissionDenied title="Restricted" description="This area is restricted." />);
    expect(screen.getByRole("heading", { name: "Restricted" })).toBeInTheDocument();
  });
});
