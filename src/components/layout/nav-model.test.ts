import { describe, expect, it } from "vitest";

import {
  NAV_BY_EXPERIENCE,
  OPERATIONS_NAV,
  PARTICIPANT_NAV,
  SHELTER_NAV,
} from "./nav-model";

/**
 * Navigation models must match docs/ux/information-architecture.md exactly.
 */
describe("navigation models (information-architecture.md)", () => {
  it("participant nav lists the seven IA items in order", () => {
    expect(PARTICIPANT_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "My Application",
      "My Placement",
      "My Hours",
      "Certifications",
      "Profile",
      "Help",
    ]);
  });

  it("shelter nav lists the seven IA items in order", () => {
    expect(SHELTER_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "Participants",
      "Placements",
      "Timesheets",
      "Evaluations",
      "Incidents",
      "Organization",
    ]);
  });

  it("operations nav lists the eight IA items in order", () => {
    expect(OPERATIONS_NAV.map((i) => i.label)).toEqual([
      "Dashboard",
      "Applications",
      "Participants",
      "Placements",
      "Shelters",
      "Training",
      "Reports",
      "Administration",
    ]);
  });

  it("every item routes inside its own experience prefix", () => {
    for (const [experience, items] of Object.entries(NAV_BY_EXPERIENCE)) {
      for (const item of items) {
        expect(item.href.startsWith(`/${experience}`), `${item.label} -> ${item.href}`).toBe(
          true,
        );
      }
    }
  });

  it("each experience has exactly one available destination so far (its dashboard)", () => {
    for (const items of Object.values(NAV_BY_EXPERIENCE)) {
      const available = items.filter((i) => i.available);
      expect(available).toHaveLength(1);
      expect(available[0].label).toBe("Dashboard");
    }
  });
});
