import { EnrollmentStatus, MatchStatus } from "@/generated/prisma/client";
import { LifecycleError } from "@/server/errors/app-error";

/**
 * PlacementMatch lifecycle rules (Stories 4.3–4.8;
 * docs/product/placement-lifecycle.md). Action-based transitions only —
 * never a status dropdown. DRAFT is coordinator-internal; PROPOSED is the
 * moment the record first crosses the organization boundary (4.4);
 * CHANGE_REQUESTED loops back through PROPOSED after edits (4.7);
 * APPROVED (4.8) and the negative outcomes are terminal for the match.
 */

export const ALLOWED_MATCH_TRANSITIONS: Readonly<
  Record<MatchStatus, readonly MatchStatus[]>
> = {
  [MatchStatus.DRAFT]: [MatchStatus.PROPOSED, MatchStatus.WITHDRAWN],
  [MatchStatus.PROPOSED]: [
    MatchStatus.APPROVED,
    MatchStatus.CHANGE_REQUESTED,
    MatchStatus.DECLINED,
    MatchStatus.WITHDRAWN,
    MatchStatus.EXPIRED,
  ],
  [MatchStatus.CHANGE_REQUESTED]: [
    MatchStatus.PROPOSED,
    MatchStatus.DECLINED,
    MatchStatus.WITHDRAWN,
  ],
  [MatchStatus.APPROVED]: [],
  [MatchStatus.DECLINED]: [],
  [MatchStatus.WITHDRAWN]: [],
  [MatchStatus.EXPIRED]: [],
};

export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  if (!ALLOWED_MATCH_TRANSITIONS[from].includes(to)) {
    throw new LifecycleError(
      `A match cannot move from ${from.toLowerCase().replaceAll("_", " ")} to ${to.toLowerCase().replaceAll("_", " ")}.`,
    );
  }
}

/**
 * Why a draft cannot be created for this pairing, or null when it can
 * (Story 4.3 AC2 — the reason is named in plain language, referencing the
 * one-placement-at-a-time rule). Placement conflicts activate when the
 * Placement model lands (4.8/Epic 5).
 */
export function draftCreationBlockReason(input: {
  enrollmentStatus: EnrollmentStatus;
  hasNonTerminalMatch: boolean;
  hasBlockingPlacement: boolean;
}): string | null {
  if (input.hasBlockingPlacement) {
    return "This participant already has an onboarding, active, or paused placement — one placement at a time.";
  }
  if (input.hasNonTerminalMatch) {
    return "This participant already has a match in progress (draft, proposed, or change requested) — one match at a time, per the one-placement-at-a-time rule.";
  }
  if (input.enrollmentStatus !== EnrollmentStatus.READY_FOR_MATCHING) {
    return "This enrollment isn't marked ready for matching yet (Story 3.7).";
  }
  return null;
}
