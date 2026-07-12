import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { JourneyNextStep } from "@/server/services/application-journey";
import { NextStepCard } from "./next-step-card";

const waiting: JourneyNextStep = {
  headline: "Your application is under review",
  description:
    "Our team is reading it with care. No action is needed right now — we'll let you know the moment something changes.",
  actionLabel: null,
  actionHref: null,
  tone: "waiting",
};

const action: JourneyNextStep = {
  headline: "Pick up where you left off",
  description: "Your draft is saved exactly as you left it.",
  actionLabel: "Continue Application",
  actionHref: "#application-form",
  tone: "action",
};

describe("NextStepCard (Story 2.6)", () => {
  it("announces the current stage to assistive technology (AC6)", () => {
    render(<NextStepCard step={waiting} stageLabel="Under review" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Current stage: Under review. Your application is under review.",
    );
  });

  it("renders the headline as a heading with the plain-language description", () => {
    render(<NextStepCard step={waiting} stageLabel="Under review" />);

    expect(
      screen.getByRole("heading", { name: "Your application is under review" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no action is needed right now/i)).toBeInTheDocument();
  });

  it("offers the action as a link when one exists", () => {
    render(<NextStepCard step={action} stageLabel="In progress" />);

    expect(screen.getByRole("link", { name: /Continue Application/ })).toHaveAttribute(
      "href",
      "#application-form",
    );
  });

  it("renders no action control when nothing is needed from the participant", () => {
    render(<NextStepCard step={waiting} stageLabel="Under review" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
