import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ParticipantPlacementView } from "@/server/services/placement-service";
import type { OwnWeekHoursView } from "@/server/services/timesheet-service";
import { PlacementHomeTiles } from "./placement-home-tiles";

function placement(
  overrides: Partial<ParticipantPlacementView> = {},
): ParticipantPlacementView {
  return {
    placementNumber: "PLC-2026-TEST01",
    organizationName: "Riverbend Animal Shelter",
    siteName: "Main Campus",
    siteLocation: "Denver, CO",
    stageLabel: "Active",
    stageBody: "Your placement is underway. Your schedule and supervisor are below.",
    scheduleSummary: "Tue/Thu mornings",
    startDateLabel: "June 1, 2026",
    supervisorName: "Sam Supervisor",
    active: true,
    mySteps: [],
    ...overrides,
  };
}

function weekHours(overrides: Partial<OwnWeekHoursView> = {}): OwnWeekHoursView {
  return {
    weekLabel: "Week of July 20, 2026",
    totalHours: "12.50",
    statusLabel: null,
    ...overrides,
  };
}

describe("PlacementHomeTiles (placed participant home)", () => {
  it("names the site and organization", () => {
    render(
      <PlacementHomeTiles
        placement={placement()}
        weekHours={weekHours()}
        certificationCount={2}
      />,
    );

    expect(screen.getByText("Main Campus")).toBeInTheDocument();
    expect(screen.getByText("Riverbend Animal Shelter")).toBeInTheDocument();
  });

  it("shows the schedule with a Review Placement action", () => {
    render(
      <PlacementHomeTiles
        placement={placement()}
        weekHours={weekHours()}
        certificationCount={2}
      />,
    );

    expect(screen.getByText("Tue/Thu mornings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Placement" })).toHaveAttribute(
      "href",
      "/participant/placement",
    );
  });

  it("stays calm when the schedule isn't set yet", () => {
    render(
      <PlacementHomeTiles
        placement={placement({ scheduleSummary: null })}
        weekHours={weekHours()}
        certificationCount={0}
      />,
    );

    expect(screen.getByText("Being set up")).toBeInTheDocument();
  });

  it("links this week's hours to My Hours", () => {
    render(
      <PlacementHomeTiles
        placement={placement()}
        weekHours={weekHours()}
        certificationCount={2}
      />,
    );

    expect(screen.getByText("12.50")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add or review hours" })).toHaveAttribute(
      "href",
      "/participant/hours",
    );
  });

  it("shows a zero-hours week when nothing is recorded yet", () => {
    render(
      <PlacementHomeTiles placement={placement()} weekHours={null} certificationCount={2} />,
    );

    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("counts certifications and links to the record", () => {
    render(
      <PlacementHomeTiles
        placement={placement()}
        weekHours={weekHours()}
        certificationCount={3}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See what's on record" })).toHaveAttribute(
      "href",
      "/participant/certifications",
    );
  });
});
