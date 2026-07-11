import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a semantic button with an accessible name", () => {
    render(<Button>Continue Application</Button>);
    expect(screen.getByRole("button", { name: "Continue Application" })).toBeInTheDocument();
  });

  it("defaults to type=button so it never submits forms accidentally", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it.each(["primary", "secondary", "danger"] as const)(
    "renders the explicit %s variant",
    (variant) => {
      render(<Button variant={variant}>Label</Button>);
      const button = screen.getByRole("button", { name: "Label" });
      expect(button.className).toContain(
        variant === "primary"
          ? "bg-primary"
          : variant === "secondary"
            ? "border-base-300"
            : "bg-error",
      );
    },
  );

  it("shows a visible focus indicator via focus-visible styling", () => {
    render(<Button>Focus me</Button>);
    expect(screen.getByRole("button", { name: "Focus me" }).className).toContain(
      "focus-visible:outline-2",
    );
  });

  it("is keyboard-operable", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Approve Hours</Button>);

    await user.tab();
    expect(screen.getByRole("button", { name: "Approve Hours" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submit Application
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
