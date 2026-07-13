import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReadinessCard } from "./readiness-card";

describe("ReadinessCard (Story 3.6, AC5)", () => {
  it("lists what's left in plain, respectful language — no internal codes", () => {
    render(
      <ReadinessCard
        readiness={{
          ready: false,
          items: [
            { kind: "training", label: "Complete training: Workplace Readiness and Communication" },
            { kind: "certification", label: "Renew: Pet First Aid & CPR (it has expired)" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your path to matching" })).toBeInTheDocument();
    expect(
      screen.getByText("2 things left before we can start matching you with a shelter — at your own pace."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Complete training: Workplace Readiness and Communication"),
    ).toBeInTheDocument();
    expect(screen.getByText("Renew: Pet First Aid & CPR (it has expired)")).toBeInTheDocument();
    // No internal jargon or judgmental phrasing.
    expect(screen.queryByText(/NOT_STARTED|BLOCKER|fail/i)).not.toBeInTheDocument();
  });

  it("celebrates readiness warmly when nothing is left", () => {
    render(<ReadinessCard readiness={{ ready: true, items: [] }} />);

    expect(
      screen.getByRole("heading", { name: /You're ready for matching/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/wonderful work/i)).toBeInTheDocument();
  });

  it("uses singular phrasing for a single remaining item", () => {
    render(
      <ReadinessCard
        readiness={{ ready: false, items: [{ kind: "task", label: "Finish: Attend orientation" }] }}
      />,
    );
    expect(
      screen.getByText(/One thing left before we can start matching you/),
    ).toBeInTheDocument();
  });
});
