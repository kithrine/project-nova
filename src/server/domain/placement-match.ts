import {
  EnrollmentStatus,
  MatchStatus,
  ParticipantMatchDecision,
  ShelterMatchDecision,
} from "@/generated/prisma/client";
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
 * The proposal decision window (Story 4.4): a Proposed match with NO
 * decision from either party inside this window is eligible to expire.
 * A program parameter; adjust without a superseding ADR.
 */
export const DECISION_WINDOW_DAYS = 14;

export function decisionWindowEnd(proposedAt: Date): Date {
  return new Date(proposedAt.getTime() + DECISION_WINDOW_DAYS * 86_400_000);
}

/**
 * The core fields a match must carry before it can cross the organization
 * boundary (Story 4.4 AC2) — missing ones are named to the coordinator.
 * Participant, host, and site are structurally present on every match.
 */
export function proposalMissingFields(match: {
  proposedSupervisorId: string | null;
  proposedSchedule: string | null;
  proposedStartDate: Date | null;
  proposedEndDate: Date | null;
}): string[] {
  const missing: string[] = [];
  if (!match.proposedSupervisorId) missing.push("Candidate supervisor");
  if (!match.proposedSchedule) missing.push("Candidate schedule");
  if (!match.proposedStartDate) missing.push("Candidate start date");
  if (!match.proposedEndDate) missing.push("Candidate end date");
  return missing;
}

/**
 * A Proposed match expires only when the window has passed AND neither
 * decision track has moved from Pending (Story 4.4 AC5).
 */
export function isExpiredProposal(
  match: {
    status: MatchStatus;
    decisionWindowEndsAt: Date | null;
    participantDecision: string;
    shelterDecision: string;
  },
  now: Date = new Date(),
): boolean {
  return (
    match.status === MatchStatus.PROPOSED &&
    match.decisionWindowEndsAt !== null &&
    match.decisionWindowEndsAt.getTime() < now.getTime() &&
    match.participantDecision === "PENDING" &&
    match.shelterDecision === "PENDING"
  );
}

/**
 * Why a decision cannot be recorded on this match's track right now, or
 * null when it can (Stories 4.5/4.6, AC4/AC6). Decisions exist only on a
 * live proposal, and each track is one-way for the current proposal cycle
 * — a changed mind routes through Operations, never a reopened control
 * (RULES.md: no arbitrary lifecycle status dropdowns).
 */
export function decisionBlockReason(match: {
  status: MatchStatus;
  decision: string;
}): string | null {
  if (match.status !== MatchStatus.PROPOSED) {
    return "Decisions can only be recorded while a match is proposed.";
  }
  if (match.decision !== "PENDING") {
    return "This decision has already been recorded for the current proposal.";
  }
  return null;
}

/**
 * A participant decline is a unilateral veto (Story 4.5 AC2): the match
 * itself becomes Declined regardless of the shelter track. An accept only
 * satisfies one of the two 4.8 prerequisites — the match stays Proposed.
 */
export function matchStatusAfterParticipantDecision(
  decision: ParticipantMatchDecision,
): MatchStatus {
  return decision === ParticipantMatchDecision.DECLINED
    ? MatchStatus.DECLINED
    : MatchStatus.PROPOSED;
}

/**
 * The shelter decision's effect on the match itself (Story 4.6): a
 * decline is a unilateral veto (AC3); a change request hands the match to
 * the coordinator's 4.7 worklist (AC2); an approval only satisfies one of
 * the two 4.8 prerequisites — the match stays Proposed (AC1).
 */
export function matchStatusAfterShelterDecision(
  decision: ShelterMatchDecision,
): MatchStatus {
  switch (decision) {
    case ShelterMatchDecision.DECLINED:
      return MatchStatus.DECLINED;
    case ShelterMatchDecision.CHANGE_REQUESTED:
      return MatchStatus.CHANGE_REQUESTED;
    default:
      return MatchStatus.PROPOSED;
  }
}

/**
 * A note is required when requesting changes or declining (Story 4.6
 * AC2/AC3) so the coordinator has something actionable — operational
 * content only, never participant background information.
 */
export function shelterDecisionRequiresNote(decision: ShelterMatchDecision): boolean {
  return decision !== ShelterMatchDecision.APPROVED;
}

/**
 * Everything still standing between a match and final approval (Story
 * 4.8 AC2) — the human gate stays disabled with each outstanding
 * prerequisite NAMED, never a mystery. An empty list means the
 * coordinator may take the explicit approval action (ADR-011: the system
 * surfaces eligibility; a human makes the decision).
 */
export function approvalBlockers(
  match: {
    status: MatchStatus;
    participantDecision: ParticipantMatchDecision;
    shelterDecision: ShelterMatchDecision;
  },
  hasBlockingPlacement: boolean,
): string[] {
  if (match.status !== MatchStatus.PROPOSED) {
    return ["Only a proposed match can be approved."];
  }
  const blockers: string[] = [];
  if (match.participantDecision !== ParticipantMatchDecision.ACCEPTED) {
    blockers.push("Waiting on the participant's acceptance.");
  }
  if (match.shelterDecision !== ShelterMatchDecision.APPROVED) {
    blockers.push("Waiting on the shelter's approval.");
  }
  if (hasBlockingPlacement) {
    blockers.push(
      "This participant already has a placement in progress — approving would create a second one.",
    );
  }
  return blockers;
}

/**
 * The cycle-boundary archive line (Story 4.7): when a revision or
 * withdrawal closes a proposal cycle, the outgoing decision values and
 * the shelter's note are written into the lifecycle event's detail before
 * the row's per-cycle fields reset — never silently overwritten.
 */
export function describePriorCycle(cycle: {
  participantDecisionLabel: string;
  shelterDecisionLabel: string;
  shelterDecisionNote: string | null;
}): string {
  const note = cycle.shelterDecisionNote
    ? `; shelter note: "${cycle.shelterDecisionNote}"`
    : "";
  return `Prior cycle — participant: ${cycle.participantDecisionLabel}; shelter: ${cycle.shelterDecisionLabel}${note}`;
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
    return "This participant already has a placement in progress (from approval through active) — one placement at a time.";
  }
  if (input.hasNonTerminalMatch) {
    return "This participant already has a match in progress (draft, proposed, or change requested) — one match at a time, per the one-placement-at-a-time rule.";
  }
  if (input.enrollmentStatus !== EnrollmentStatus.READY_FOR_MATCHING) {
    return "This enrollment isn't marked ready for matching yet (Story 3.7).";
  }
  return null;
}
