import { describe, expect, it } from "vitest";

import { MatchStatus } from "@/generated/prisma/client";
import {
  classifyQueueCandidate,
  NON_TERMINAL_MATCH_STATUSES,
} from "./matching-queue";

describe("classifyQueueCandidate (Story 4.1 inclusion rules)", () => {
  it("marks a ready participant with no match and no placement as awaiting (AC1)", () => {
    expect(
      classifyQueueCandidate({ hasNonTerminalMatch: false, hasBlockingPlacement: false }),
    ).toBe("AWAITING_MATCH");
  });

  it("marks a participant with a non-terminal match as in progress — never duplicated (AC2)", () => {
    expect(
      classifyQueueCandidate({ hasNonTerminalMatch: true, hasBlockingPlacement: false }),
    ).toBe("MATCH_IN_PROGRESS");
  });

  it("excludes a participant with a blocking placement entirely (AC3)", () => {
    expect(
      classifyQueueCandidate({ hasNonTerminalMatch: false, hasBlockingPlacement: true }),
    ).toBe("EXCLUDED");
    // Placement conflicts outrank match state.
    expect(
      classifyQueueCandidate({ hasNonTerminalMatch: true, hasBlockingPlacement: true }),
    ).toBe("EXCLUDED");
  });

  it("treats exactly Draft, Proposed, and Change Requested as non-terminal", () => {
    expect(NON_TERMINAL_MATCH_STATUSES).toEqual([
      MatchStatus.DRAFT,
      MatchStatus.PROPOSED,
      MatchStatus.CHANGE_REQUESTED,
    ]);
    for (const status of [
      MatchStatus.APPROVED,
      MatchStatus.DECLINED,
      MatchStatus.WITHDRAWN,
      MatchStatus.EXPIRED,
    ]) {
      expect(NON_TERMINAL_MATCH_STATUSES).not.toContain(status);
    }
  });
});
