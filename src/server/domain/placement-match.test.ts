import { describe, expect, it } from "vitest";

import {
  EnrollmentStatus,
  MatchStatus,
  ParticipantMatchDecision,
  ShelterMatchDecision,
} from "@/generated/prisma/client";
import {
  ALLOWED_MATCH_TRANSITIONS,
  assertMatchTransition,
  decisionBlockReason,
  decisionWindowEnd,
  describePriorCycle,
  draftCreationBlockReason,
  isExpiredProposal,
  matchStatusAfterParticipantDecision,
  matchStatusAfterShelterDecision,
  proposalMissingFields,
  shelterDecisionRequiresNote,
} from "./placement-match";

describe("match transitions (Stories 4.3-4.8 lifecycle)", () => {
  it("allows Draft only to Proposed or Withdrawn", () => {
    expect(ALLOWED_MATCH_TRANSITIONS[MatchStatus.DRAFT]).toEqual([
      MatchStatus.PROPOSED,
      MatchStatus.WITHDRAWN,
    ]);
    expect(() =>
      assertMatchTransition(MatchStatus.DRAFT, MatchStatus.WITHDRAWN),
    ).not.toThrow();
    expect(() => assertMatchTransition(MatchStatus.DRAFT, MatchStatus.APPROVED)).toThrow(
      /cannot move from draft to approved/i,
    );
  });

  it("treats Approved, Declined, Withdrawn, and Expired as terminal", () => {
    for (const terminal of [
      MatchStatus.APPROVED,
      MatchStatus.DECLINED,
      MatchStatus.WITHDRAWN,
      MatchStatus.EXPIRED,
    ]) {
      expect(ALLOWED_MATCH_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("lets Change Requested loop back through Proposed (4.7)", () => {
    expect(() =>
      assertMatchTransition(MatchStatus.CHANGE_REQUESTED, MatchStatus.PROPOSED),
    ).not.toThrow();
  });
});

describe("proposal gate and window (Story 4.4)", () => {
  const complete = {
    proposedSupervisorId: "user_1",
    proposedSchedule: "Mon/Wed mornings",
    proposedStartDate: new Date("2026-08-01T00:00:00Z"),
    proposedEndDate: new Date("2026-12-01T00:00:00Z"),
  };

  it("passes a complete draft and names every missing core field (AC2)", () => {
    expect(proposalMissingFields(complete)).toEqual([]);
    expect(
      proposalMissingFields({
        proposedSupervisorId: null,
        proposedSchedule: null,
        proposedStartDate: null,
        proposedEndDate: null,
      }),
    ).toEqual([
      "Candidate supervisor",
      "Candidate schedule",
      "Candidate start date",
      "Candidate end date",
    ]);
  });

  it("computes the decision window from the proposal moment", () => {
    const proposedAt = new Date("2026-07-13T00:00:00.000Z");
    expect(decisionWindowEnd(proposedAt).toISOString()).toBe(
      "2026-07-27T00:00:00.000Z",
    );
  });

  it("expires only past-window proposals with BOTH tracks still pending (AC5)", () => {
    const base = {
      status: MatchStatus.PROPOSED,
      decisionWindowEndsAt: new Date("2026-07-01T00:00:00Z"),
      participantDecision: "PENDING",
      shelterDecision: "PENDING",
    };
    const now = new Date("2026-07-13T00:00:00Z");
    expect(isExpiredProposal(base, now)).toBe(true);
    expect(isExpiredProposal({ ...base, participantDecision: "ACCEPTED" }, now)).toBe(false);
    expect(isExpiredProposal({ ...base, shelterDecision: "APPROVED" }, now)).toBe(false);
    expect(
      isExpiredProposal(
        { ...base, decisionWindowEndsAt: new Date("2026-08-01T00:00:00Z") },
        now,
      ),
    ).toBe(false);
    expect(isExpiredProposal({ ...base, status: MatchStatus.DRAFT }, now)).toBe(false);
  });
});

describe("decision recording rules (Story 4.5)", () => {
  it("allows a decision only on a live proposal with the track still pending", () => {
    expect(
      decisionBlockReason({ status: MatchStatus.PROPOSED, decision: "PENDING" }),
    ).toBeNull();
    for (const status of [
      MatchStatus.DRAFT,
      MatchStatus.DECLINED,
      MatchStatus.WITHDRAWN,
      MatchStatus.EXPIRED,
      MatchStatus.APPROVED,
    ]) {
      expect(decisionBlockReason({ status, decision: "PENDING" })).toMatch(
        /while a match is proposed/i,
      );
    }
  });

  it("is one-way for the current proposal cycle — no self-service reversal", () => {
    expect(
      decisionBlockReason({ status: MatchStatus.PROPOSED, decision: "ACCEPTED" }),
    ).toMatch(/already been recorded/i);
    expect(
      decisionBlockReason({ status: MatchStatus.PROPOSED, decision: "DECLINED" }),
    ).toMatch(/already been recorded/i);
  });

  it("treats a participant decline as a unilateral veto (AC2)", () => {
    expect(
      matchStatusAfterParticipantDecision(ParticipantMatchDecision.DECLINED),
    ).toBe(MatchStatus.DECLINED);
    expect(
      matchStatusAfterParticipantDecision(ParticipantMatchDecision.ACCEPTED),
    ).toBe(MatchStatus.PROPOSED);
  });
});

describe("shelter decision rules (Story 4.6)", () => {
  it("maps each decision to its forced match status (AC1-AC3)", () => {
    expect(matchStatusAfterShelterDecision(ShelterMatchDecision.APPROVED)).toBe(
      MatchStatus.PROPOSED,
    );
    expect(
      matchStatusAfterShelterDecision(ShelterMatchDecision.CHANGE_REQUESTED),
    ).toBe(MatchStatus.CHANGE_REQUESTED);
    expect(matchStatusAfterShelterDecision(ShelterMatchDecision.DECLINED)).toBe(
      MatchStatus.DECLINED,
    );
  });

  it("requires a note exactly when the coordinator needs something actionable", () => {
    expect(shelterDecisionRequiresNote(ShelterMatchDecision.APPROVED)).toBe(false);
    expect(shelterDecisionRequiresNote(ShelterMatchDecision.CHANGE_REQUESTED)).toBe(true);
    expect(shelterDecisionRequiresNote(ShelterMatchDecision.DECLINED)).toBe(true);
  });
});

describe("describePriorCycle (Story 4.7 history archiving)", () => {
  it("captures both decision values and the shelter note", () => {
    expect(
      describePriorCycle({
        participantDecisionLabel: "Accepted",
        shelterDecisionLabel: "Change requested",
        shelterDecisionNote: "Weekend mornings work better",
      }),
    ).toBe(
      'Prior cycle — participant: Accepted; shelter: Change requested; shelter note: "Weekend mornings work better"',
    );
  });

  it("omits the note clause when no note exists", () => {
    expect(
      describePriorCycle({
        participantDecisionLabel: "Pending",
        shelterDecisionLabel: "Pending",
        shelterDecisionNote: null,
      }),
    ).toBe("Prior cycle — participant: Pending; shelter: Pending");
  });
});

describe("draftCreationBlockReason (Story 4.3 AC2)", () => {
  const clear = {
    enrollmentStatus: EnrollmentStatus.READY_FOR_MATCHING,
    hasNonTerminalMatch: false,
    hasBlockingPlacement: false,
  };

  it("allows creation for a ready, unmatched, unplaced participant", () => {
    expect(draftCreationBlockReason(clear)).toBeNull();
  });

  it("names the one-match rule for a duplicate attempt", () => {
    expect(
      draftCreationBlockReason({ ...clear, hasNonTerminalMatch: true }),
    ).toMatch(/one-placement-at-a-time rule/);
  });

  it("names the placement conflict when one exists", () => {
    expect(
      draftCreationBlockReason({ ...clear, hasBlockingPlacement: true }),
    ).toMatch(/onboarding, active, or paused placement/);
  });

  it("requires a ready-for-matching enrollment", () => {
    expect(
      draftCreationBlockReason({
        ...clear,
        enrollmentStatus: EnrollmentStatus.ONBOARDING,
      }),
    ).toMatch(/ready for matching/i);
  });
});
