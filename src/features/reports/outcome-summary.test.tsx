import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/enums";
import type { OutcomeSummaryView } from "@/server/services/reporting-service";

import { OutcomeSummaryReport } from "./outcome-summary";

function makeView(overrides: Partial<OutcomeSummaryView> = {}): OutcomeSummaryView {
  return {
    outcomes: [
      { status: PlacementStatus.COMPLETED, label: "Completed", count: 5 },
      {
        status: PlacementStatus.CONVERTED_TO_PERMANENT,
        label: "Converted to permanent employment",
        count: 3,
      },
      { status: PlacementStatus.WITHDRAWN, label: "Withdrawn", count: 1 },
      { status: PlacementStatus.TERMINATED, label: "Terminated", count: 0 },
    ],
    totalOutcomes: 9,
    certificationsEarned: 12,
    range: null,
    ...overrides,
  };
}

describe("OutcomeSummaryReport", () => {
  it("renders one card per terminal outcome plus credentials, zero counts included", () => {
    render(<OutcomeSummaryReport view={makeView()} basePath="/operations/reports/outcome-summary" />);

    const cards = screen.getByRole("list", { name: "Outcome counts" });
    const completed = within(cards).getByText("Completed").closest("li");
    expect(within(completed as HTMLElement).getByText("5")).toBeInTheDocument();

    const converted = within(cards)
      .getByText("Converted to permanent employment")
      .closest("li");
    expect(within(converted as HTMLElement).getByText("3")).toBeInTheDocument();

    // A zero-count outcome still renders as a card (never omitted).
    const terminated = within(cards).getByText("Terminated").closest("li");
    expect(within(terminated as HTMLElement).getByText("0")).toBeInTheDocument();

    const credentials = within(cards).getByText("Credentials earned").closest("li");
    expect(within(credentials as HTMLElement).getByText("12")).toBeInTheDocument();
  });

  it("uses respectful, neutral language — no stigmatizing terms anywhere", () => {
    const { container } = render(
      <OutcomeSummaryReport view={makeView()} basePath="/operations/reports/outcome-summary" />,
    );
    expect(container.textContent).not.toMatch(/fail|criminal|drop.?out|quit/i);
    // Terminal states get plain descriptions, not judgments.
    expect(screen.getByText("Participants who chose to step away.")).toBeInTheDocument();
    expect(screen.getByText("Placements ended by Nova Operations.")).toBeInTheDocument();
  });

  it("shows 'Program to date' with empty date inputs when no range applies", () => {
    render(<OutcomeSummaryReport view={makeView()} basePath="/operations/reports/outcome-summary" />);
    expect(screen.getByText("Program to date.")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.queryByText("View program to date")).toBeNull();
  });

  it("describes an applied range and offers the program-to-date reset", () => {
    render(
      <OutcomeSummaryReport
        view={makeView({
          range: {
            fromIso: "2026-02-01",
            toIso: "2026-02-28",
            fromLabel: "Feb 1, 2026",
            toLabel: "Feb 28, 2026",
          },
        })}
        basePath="/operations/reports/outcome-summary"
      />,
    );
    expect(
      screen.getByText("Outcomes from Feb 1, 2026 through Feb 28, 2026."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View program to date" })).toBeInTheDocument();
  });

  it("adds the empty note when nothing is recorded, keeping the zero cards", () => {
    render(
      <OutcomeSummaryReport
        view={makeView({
          outcomes: makeView().outcomes.map((o) => ({ ...o, count: 0 })),
          totalOutcomes: 0,
          certificationsEarned: 0,
        })}
        basePath="/operations/reports/outcome-summary"
      />,
    );
    expect(screen.getByText("No outcomes recorded in this period yet.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Outcome counts" })).toBeInTheDocument();
  });
});
