import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HoursByFundingView } from "@/server/services/reporting-service";

import { HoursByFundingReport } from "./hours-by-funding";

function makeView(overrides: Partial<HoursByFundingView> = {}): HoursByFundingView {
  return {
    groups: [
      {
        fundingSourceId: "src-a",
        name: "Second Chance Grant",
        kindLabel: "Grant",
        code: "AWD-2026-01",
        lockedHours: "23.25",
        approvedHours: "8.25",
        lockedTimesheetCount: 3,
        approvedTimesheetCount: 1,
        placementCount: 2,
      },
      {
        fundingSourceId: null,
        name: "No funding assigned",
        kindLabel: null,
        code: null,
        lockedHours: "5.25",
        approvedHours: "0.00",
        lockedTimesheetCount: 1,
        approvedTimesheetCount: 0,
        placementCount: 1,
      },
    ],
    totalLockedHours: "28.50",
    totalApprovedHours: "8.25",
    range: {
      fromIso: "2026-06-01",
      toIso: "2026-06-30",
      fromLabel: "Jun 1, 2026",
      toLabel: "Jun 30, 2026",
      fromParams: true,
    },
    ...overrides,
  };
}

describe("HoursByFundingReport", () => {
  it("always displays the ADR-020 provisional notice", () => {
    render(<HoursByFundingReport view={makeView()} basePath="/operations/reports/hours-by-funding" />);

    const notice = screen.getByRole("note", { name: "Provisional format notice" });
    expect(notice).toHaveTextContent(/provisional pilot format/i);
    expect(notice).toHaveTextContent(/ADR-020/);
  });

  it("renders grouped totals with finalized and approved hours kept separate", () => {
    render(<HoursByFundingReport view={makeView()} basePath="/operations/reports/hours-by-funding" />);

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Finalized hours" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Approved, not finalized" }),
    ).toBeInTheDocument();

    const grantRow = within(table).getByText("Second Chance Grant").closest("tr");
    expect(grantRow).not.toBeNull();
    expect(within(grantRow as HTMLElement).getByText("23.25")).toBeInTheDocument();
    expect(within(grantRow as HTMLElement).getByText("8.25")).toBeInTheDocument();
    expect(within(grantRow as HTMLElement).getByText("AWD-2026-01")).toBeInTheDocument();

    // The unassigned bucket is visible, never silently dropped.
    expect(within(table).getByText("No funding assigned")).toBeInTheDocument();

    // Grand totals in the footer.
    const totalsRow = within(table).getByText("All funding sources").closest("tr");
    expect(within(totalsRow as HTMLElement).getByText("28.50")).toBeInTheDocument();
    expect(within(totalsRow as HTMLElement).getByText("8.25")).toBeInTheDocument();
  });

  it("describes the period and its Monday-attribution rule", () => {
    render(<HoursByFundingReport view={makeView()} basePath="/operations/reports/hours-by-funding" />);

    expect(
      screen.getByText(/weeks starting Jun 1, 2026 through Jun 30, 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-06-30");
  });

  it("notes when the default period is in use", () => {
    render(
      <HoursByFundingReport
        view={makeView({
          range: {
            fromIso: "2026-07-01",
            toIso: "2026-07-31",
            fromLabel: "Jul 1, 2026",
            toLabel: "Jul 31, 2026",
            fromParams: false,
          },
        })}
        basePath="/operations/reports/hours-by-funding"
      />,
    );

    expect(screen.getByText(/\(current month\)/)).toBeInTheDocument();
  });

  it("renders the empty state without a table", () => {
    render(
      <HoursByFundingReport
        view={makeView({ groups: [], totalLockedHours: "0.00", totalApprovedHours: "0.00" })}
        basePath="/operations/reports/hours-by-funding"
      />,
    );

    expect(
      screen.getByText("No finalized or approved hours in this period."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // The provisional notice still shows — the format flag never disappears.
    expect(screen.getByRole("note", { name: "Provisional format notice" })).toBeInTheDocument();
  });
});
