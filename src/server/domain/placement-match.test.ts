import { describe, expect, it } from "vitest";

import { EnrollmentStatus, MatchStatus } from "@/generated/prisma/client";
import {
  ALLOWED_MATCH_TRANSITIONS,
  assertMatchTransition,
  draftCreationBlockReason,
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
