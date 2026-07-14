import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShelterRosterView } from "@/server/services/reporting-service";

import { ShelterRoster } from "./shelter-roster";

function makeView(overrides: Partial<ShelterRosterView> = {}): ShelterRosterView {
  return {
    organizations: [
      {
        organizationId: "org-1",
        name: "Cedar Shelter",
        managers: [{ name: "Morgan Manager", email: "morgan@example.org" }],
        supervisorNames: ["Sam Supervisor", "Tay Supervisor"],
        sites: [
          { siteId: "s1", name: "Main Site", capacity: 4, activePlacementCount: 3 },
          { siteId: "s2", name: "Annex", capacity: 2, activePlacementCount: 0 },
        ],
        activePlacementCount: 3,
        totalCapacity: 6,
      },
      {
        organizationId: "org-2",
        name: "Downtown Shelter",
        managers: [],
        supervisorNames: [],
        sites: [],
        activePlacementCount: 0,
        totalCapacity: 0,
      },
    ],
    novaScope: true,
    ...overrides,
  };
}

describe("ShelterRoster", () => {
  it("lists each organization with capacity versus active counts shown numerically", () => {
    render(<ShelterRoster view={makeView()} />);

    const list = screen.getByRole("list", { name: "Participating shelters" });
    expect(within(list).getByText("Cedar Shelter")).toBeInTheDocument();
    expect(within(list).getByText("3 active of 6 capacity")).toBeInTheDocument();

    const sites = screen.getByRole("list", { name: "Sites at Cedar Shelter" });
    expect(within(sites).getByText("3 active / capacity 4")).toBeInTheDocument();
    // A zero-count site is shown as zero, never omitted (AC3).
    expect(within(sites).getByText("0 active / capacity 2")).toBeInTheDocument();
  });

  it("shows the Shelter Manager contact and assigned supervisors", () => {
    render(<ShelterRoster view={makeView()} />);

    expect(
      screen.getByText("Morgan Manager (morgan@example.org)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sam Supervisor, Tay Supervisor")).toBeInTheDocument();
  });

  it("keeps zero-placement shelters visible with words for missing staff (AC3)", () => {
    render(<ShelterRoster view={makeView()} />);

    expect(screen.getByText("Downtown Shelter")).toBeInTheDocument();
    expect(screen.getByText("0 active of 0 capacity")).toBeInTheDocument();
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
    expect(screen.getByText("None assigned")).toBeInTheDocument();
    expect(screen.getByText("No sites configured yet.")).toBeInTheDocument();
  });

  it("renders the empty state when no shelters participate (AC5)", () => {
    render(<ShelterRoster view={makeView({ organizations: [] })} />);

    expect(screen.getByText(/no participating shelters yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Participating shelters" })).toBeNull();
  });
});
