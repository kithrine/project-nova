import { PlacementStatus } from "@/generated/prisma/client";

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
