import { PlacementStatus } from "@/generated/prisma/client";

export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  [PlacementStatus.DRAFT]: "Draft",
  [PlacementStatus.PROPOSED]: "Proposed",
  [PlacementStatus.SHELTER_REVIEW]: "Shelter review",
  [PlacementStatus.APPROVED]: "Approved",
  [PlacementStatus.ONBOARDING]: "Onboarding",
  [PlacementStatus.ACTIVE]: "Active",
  [PlacementStatus.PAUSED]: "Paused",
  [PlacementStatus.COMPLETED]: "Completed",
  [PlacementStatus.CONVERTED_TO_PERMANENT]: "Converted to permanent employment",
  [PlacementStatus.WITHDRAWN]: "Withdrawn",
  [PlacementStatus.TERMINATED]: "Terminated",
};

/** The main path a placement walks (docs/product/placement-lifecycle.md). */
const MAIN_PATH: readonly PlacementStatus[] = [
  PlacementStatus.DRAFT,
  PlacementStatus.PROPOSED,
  PlacementStatus.SHELTER_REVIEW,
  PlacementStatus.APPROVED,
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
];

export const TERMINAL_PLACEMENT_STATUSES = [
  PlacementStatus.COMPLETED,
  PlacementStatus.CONVERTED_TO_PERMANENT,
  PlacementStatus.WITHDRAWN,
  PlacementStatus.TERMINATED,
] as const;

export interface TimelineStage {
  status: PlacementStatus;
  label: string;
  state: "past" | "current" | "upcoming";
}

/**
 * The Lifecycle Timeline (Story 5.1): every documented stage with the
 * current one indicated. Paused renders as the current stage alongside
 * Active's position (the Active ⇄ Paused loop); a terminal status closes
 * the timeline with itself as the final, current entry — terminal
 * placements are never reopened, so nothing renders as upcoming after
 * them. For terminal placements, lastNonTerminalStatus (from the event
 * trail) bounds how far along the main path renders as reached — a
 * placement withdrawn during Shelter Review never shows Active as past.
 */
export function buildPlacementTimeline(
  status: PlacementStatus,
  lastNonTerminalStatus?: PlacementStatus,
): TimelineStage[] {
  const isTerminal = (TERMINAL_PLACEMENT_STATUSES as readonly PlacementStatus[]).includes(
    status,
  );
  const isPaused = status === PlacementStatus.PAUSED;

  // How far along the main path this placement actually progressed.
  const reached =
    isTerminal && lastNonTerminalStatus
      ? MAIN_PATH.indexOf(
          lastNonTerminalStatus === PlacementStatus.PAUSED
            ? PlacementStatus.ACTIVE
            : lastNonTerminalStatus,
        ) + 1
      : MAIN_PATH.length;

  let stages: TimelineStage[];
  if (isTerminal || isPaused) {
    // No main-path stage is current: Paused/terminal entries append below.
    stages = MAIN_PATH.map((stage, index) => ({
      status: stage,
      label: PLACEMENT_STATUS_LABELS[stage],
      state: index < reached ? "past" : "upcoming",
    }));
  } else {
    const currentIndex = MAIN_PATH.indexOf(status);
    stages = MAIN_PATH.map((stage, index) => ({
      status: stage,
      label: PLACEMENT_STATUS_LABELS[stage],
      state:
        index < currentIndex ? "past" : index === currentIndex ? "current" : "upcoming",
    }));
  }

  if (isPaused) {
    stages.push({
      status: PlacementStatus.PAUSED,
      label: PLACEMENT_STATUS_LABELS[PlacementStatus.PAUSED],
      state: "current",
    });
  }

  if (isTerminal) {
    stages.push({
      status,
      label: PLACEMENT_STATUS_LABELS[status],
      state: "current",
    });
  }

  return stages;
}

/**
 * Placement lifecycle constants (Story 4.8 creates placements; Epic 5
 * owns the transitions — the full table arrives with Story 5.2).
 */

/**
 * Any placement in these statuses occupies the participant's pipeline:
 * it excludes them from the matching queue and blocks new match drafts
 * and approvals. Terminal statuses (Completed, Converted to Permanent
 * Employment, Withdrawn, Terminated) free the pipeline again.
 */
export const NON_TERMINAL_PLACEMENT_STATUSES = [
  PlacementStatus.DRAFT,
  PlacementStatus.PROPOSED,
  PlacementStatus.SHELTER_REVIEW,
  PlacementStatus.APPROVED,
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
] as const;

/**
 * The active tier the "one active placement per participant" partial
 * unique index enforces at the database (database-design.md;
 * business-rules.md) — the hard backstop behind application-level checks.
 */
export const ACTIVE_PLACEMENT_STATUSES = [
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
] as const;
