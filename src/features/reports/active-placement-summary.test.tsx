import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/enums";
import type {
  ActivePlacementSummaryRow,
  ActivePlacementSummaryView,
} from "@/server/services/reporting-service";

import { ActivePlacementSummary } from "./active-placement-summary";

function makeRow(overrides: Partial<ActivePlacementSummaryRow> = {}): ActivePlacementSummaryRow {
  return {
    placementId: "pl-1",
    placementNumber: "PLC-2026-000001",
    participantName: "Avery Participant",
    organizationName: "Cedar Shelter",
    siteName: "Main Site",
    supervisorName: "Sam Supervisor",
    coordinatorName: "Casey Coordinator",
    stage: PlacementStatus.ACTIVE,
    stageLabel: "Active",
    startDateIso: "2026-06-01",
    startDateLabel: "Jun 1, 2026",
    ...overrides,
  };
}

function makeView(
  overrides: Partial<ActivePlacementSummaryView> = {},
): ActivePlacementSummaryView {
  return {
    rows: [
      makeRow(),
      makeRow({
        placementId: "pl-2",
        placementNumber: "PLC-2026-000002",
        participantName: "Briar Member",
        organizationName: "Downtown Shelter",
        stage: PlacementStatus.ONBOARDING,
        stageLabel: "Onboarding",
        supervisorName: null,
        startDateIso: null,
        startDateLabel: null,
      }),
    ],
    count: 2,
    organizationOptions: [
      { value: "org-1", label: "Cedar Shelter" },
      { value: "org-2", label: "Downtown Shelter" },
    ],
    stageOptions: [
      { value: PlacementStatus.ONBOARDING, label: "Onboarding" },
      { value: PlacementStatus.ACTIVE, label: "Active" },
      { value: PlacementStatus.PAUSED, label: "Paused" },
    ],
    coordinatorOptions: [{ value: "u-1", label: "Casey Coordinator" }],
    applied: {
      organizationId: null,
      stage: null,
      coordinatorUserId: null,
      sort: "organization",
      direction: "asc",
    },
    novaScope: true,
    ...overrides,
  };
}

describe("ActivePlacementSummary", () => {
  it("renders every in-progress placement with an accessible table and a live count", () => {
    render(<ActivePlacementSummary view={makeView()} basePath="/operations/reports/active-placements" />);

    expect(screen.getByText("2 in-progress placements")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: /participant/i }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: /host organization/i }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Site" })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Supervisor" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Coordinator" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Avery Participant")).toBeInTheDocument();
    expect(within(table).getByText("Briar Member")).toBeInTheDocument();
    // Stage renders as text (icon is decorative), and missing values read
    // as words, never blank cells.
    expect(within(table).getByText("Onboarding")).toBeInTheDocument();
    expect(within(table).getByText("Not assigned")).toBeInTheDocument();
    expect(within(table).getByText("Not set")).toBeInTheDocument();

    // The default sort is exposed to assistive technology.
    expect(
      within(table).getByRole("columnheader", { name: /host organization/i }),
    ).toHaveAttribute("aria-sort", "ascending");

    // The mobile card list carries the same rows.
    const cards = screen.getByRole("list", { name: "In-progress placements" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows filter controls and a clear link once filters are applied", () => {
    render(
      <ActivePlacementSummary
        view={makeView({
          rows: [makeRow()],
          count: 1,
          applied: {
            organizationId: "org-1",
            stage: null,
            coordinatorUserId: null,
            sort: "organization",
            direction: "asc",
          },
        })}
        basePath="/operations/reports/active-placements"
      />,
    );

    expect(screen.getByRole("form", { name: "Report filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Host organization")).toHaveValue("org-1");
    expect(screen.getByLabelText("Lifecycle stage")).toHaveValue("");
    expect(screen.getByText("1 in-progress placement")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/operations/reports/active-placements",
    );
  });

  it("hides Nova-wide filters from org-scoped viewers", () => {
    render(
      <ActivePlacementSummary
        view={makeView({ novaScope: false })}
        basePath="/operations/reports/active-placements"
      />,
    );

    expect(screen.queryByLabelText("Host organization")).toBeNull();
    expect(screen.queryByLabelText("Coordinator")).toBeNull();
    expect(screen.getByLabelText("Lifecycle stage")).toBeInTheDocument();
  });

  it("renders the empty state when no placements are in progress (AC6)", () => {
    render(
      <ActivePlacementSummary
        view={makeView({ rows: [], count: 0 })}
        basePath="/operations/reports/active-placements"
      />,
    );

    expect(screen.getByText(/no in-progress placements yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("distinguishes an empty filter result from an empty pilot", () => {
    render(
      <ActivePlacementSummary
        view={makeView({
          rows: [],
          count: 0,
          applied: {
            organizationId: null,
            stage: PlacementStatus.PAUSED,
            coordinatorUserId: null,
            sort: "organization",
            direction: "asc",
          },
        })}
        basePath="/operations/reports/active-placements"
      />,
    );

    expect(screen.getByText("No placements match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toBeInTheDocument();
  });
});
