import { MatchStatus } from "@/generated/prisma/client";

/**
 * Matching-queue inclusion rules (Story 4.1;
 * docs/product/placement-lifecycle.md, docs/product/business-rules.md).
 * A READY_FOR_MATCHING enrollment surfaces as:
 * - AWAITING_MATCH   — no non-terminal match, no blocking placement;
 * - MATCH_IN_PROGRESS — a Draft/Proposed/Change-Requested match exists
 *   (shown, never duplicated as awaiting, so no second match gets started);
 * - EXCLUDED          — an onboarding/active/paused placement exists
 *   (one placement at a time; the Placement model arrives with 4.8/Epic 5,
 *   so callers pass false until then — the rule is ready for it).
 */

export const NON_TERMINAL_MATCH_STATUSES: readonly MatchStatus[] = [
  MatchStatus.DRAFT,
  MatchStatus.PROPOSED,
  MatchStatus.CHANGE_REQUESTED,
];

export type QueueCandidateState = "AWAITING_MATCH" | "MATCH_IN_PROGRESS" | "EXCLUDED";

export function classifyQueueCandidate(input: {
  hasNonTerminalMatch: boolean;
  hasBlockingPlacement: boolean;
}): QueueCandidateState {
  if (input.hasBlockingPlacement) return "EXCLUDED";
  if (input.hasNonTerminalMatch) return "MATCH_IN_PROGRESS";
  return "AWAITING_MATCH";
}
