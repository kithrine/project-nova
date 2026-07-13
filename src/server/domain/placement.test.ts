import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/client";
import {
  buildPlacementTimeline,
  NON_TERMINAL_PLACEMENT_STATUSES,
  PLACEMENT_STATUS_LABELS,
  TERMINAL_PLACEMENT_STATUSES,
} from "./placement";

describe("buildPlacementTimeline (Story 5.1)", () => {
  it("marks the current main-path stage with past stages behind it", () => {
    const timeline = buildPlacementTimeline(PlacementStatus.SHELTER_REVIEW);
    expect(timeline.map((s) => s.state)).toEqual([
      "past",
      "past",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(timeline[2].label).toBe("Shelter review");
  });

  it("renders the Active ⇄ Paused loop with Paused as the current stage", () => {
    const timeline = buildPlacementTimeline(PlacementStatus.PAUSED);
    expect(timeline).toHaveLength(7);
    expect(timeline[5]).toMatchObject({
      status: PlacementStatus.ACTIVE,
      state: "past",
    });
    expect(timeline[6]).toMatchObject({
      status: PlacementStatus.PAUSED,
      state: "current",
    });
  });

  it("closes terminal placements with the terminal stage current and nothing reopening (AC4)", () => {
    for (const terminal of TERMINAL_PLACEMENT_STATUSES) {
      const timeline = buildPlacementTimeline(terminal, PlacementStatus.ACTIVE);
      const last = timeline[timeline.length - 1];
      expect(last).toMatchObject({ status: terminal, state: "current" });
      // Exactly one current stage, ever.
      expect(timeline.filter((s) => s.state === "current")).toHaveLength(1);
    }
  });

  it("bounds a terminal timeline by where the placement actually got to", () => {
    const timeline = buildPlacementTimeline(
      PlacementStatus.WITHDRAWN,
      PlacementStatus.SHELTER_REVIEW,
    );
    // Draft, Proposed, Shelter review reached; Approved onward never were.
    expect(timeline.slice(0, 3).every((s) => s.state === "past")).toBe(true);
    expect(timeline[3].state).toBe("upcoming");
    expect(timeline[5].state).toBe("upcoming");
    expect(timeline[6]).toMatchObject({
      status: PlacementStatus.WITHDRAWN,
      state: "current",
    });
  });

  it("labels every documented stage", () => {
    for (const status of [
      ...NON_TERMINAL_PLACEMENT_STATUSES,
      ...TERMINAL_PLACEMENT_STATUSES,
    ]) {
      expect(PLACEMENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
