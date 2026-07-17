import { describe, expect, it } from "vitest";

import { ApplicationStatus } from "@/generated/prisma/client";
import {
  compareQueueEntries,
  contextualActionsFor,
  DISQUALIFICATION_CATEGORIES,
  isDecisionCategory,
  isDisqualifyingCategory,
  OPERATIONS_STATUS_LABELS,
  OPERATIONS_STATUS_TONES,
  ORDINARY_REJECTION_CATEGORIES,
  QUEUE_VISIBLE_STATUSES,
  resolveQueueFilter,
  resolveWorkspaceTab,
  WORKSPACE_TABS,
} from "./application-review-service";

const S = ApplicationStatus;

describe("queue visibility and filtering (Story 2.7)", () => {
  it("never exposes drafts to Operations", () => {
    expect(QUEUE_VISIBLE_STATUSES).not.toContain(S.DRAFT);
    expect(resolveQueueFilter("DRAFT")).toBe("all");
  });

  it("accepts each visible status as a filter and falls back to all otherwise", () => {
    for (const status of QUEUE_VISIBLE_STATUSES) {
      expect(resolveQueueFilter(status)).toBe(status);
    }
    expect(resolveQueueFilter(undefined)).toBe("all");
    expect(resolveQueueFilter("nonsense")).toBe("all");
  });

  it("labels every status with its real internal phase name", () => {
    for (const status of Object.values(S)) {
      expect(OPERATIONS_STATUS_LABELS[status], `missing label for ${status}`).toBeTruthy();
    }
  });

  it("assigns every status a badge tone, with Rejected recoverable (ADR-016)", () => {
    for (const status of Object.values(S)) {
      expect(OPERATIONS_STATUS_TONES[status], `missing tone for ${status}`).toBeTruthy();
    }
    expect(OPERATIONS_STATUS_TONES[S.REJECTED]).toBe("warning");
    expect(OPERATIONS_STATUS_TONES[S.DISQUALIFIED]).toBe("error");
  });
});

describe("compareQueueEntries (needs-attention ordering)", () => {
  it("surfaces submitted and in-review applications before decided ones", () => {
    const entries = [
      { status: S.ACCEPTED, submittedAtIso: "2026-01-01" },
      { status: S.SUBMITTED, submittedAtIso: "2026-07-01" },
      { status: S.REJECTED, submittedAtIso: "2026-02-01" },
      { status: S.INTERVIEW, submittedAtIso: "2026-03-01" },
    ].sort(compareQueueEntries);

    expect(entries.map((e) => e.status)).toEqual([
      S.SUBMITTED,
      S.INTERVIEW,
      S.ACCEPTED,
      S.REJECTED,
    ]);
  });

  it("puts the longest-waiting submission first within a phase", () => {
    const entries = [
      { status: S.SUBMITTED, submittedAtIso: "2026-07-10" },
      { status: S.SUBMITTED, submittedAtIso: "2026-07-01" },
      { status: S.SUBMITTED, submittedAtIso: null },
    ].sort(compareQueueEntries);

    expect(entries.map((e) => e.submittedAtIso)).toEqual([
      "2026-07-01",
      "2026-07-10",
      null, // no submission date sorts last
    ]);
  });
});

describe("resolveWorkspaceTab", () => {
  it("exposes exactly the six specified tabs and defaults to Overview", () => {
    expect(WORKSPACE_TABS).toEqual([
      "overview",
      "documents",
      "eligibility",
      "interview",
      "background",
      "history",
    ]);
    expect(resolveWorkspaceTab(undefined)).toBe("overview");
    expect(resolveWorkspaceTab("bogus")).toBe("overview");
    expect(resolveWorkspaceTab("background")).toBe("background");
  });
});

describe("contextualActionsFor", () => {
  it("stubs nothing — every Epic 2 workflow is live on its own panel", () => {
    for (const status of Object.values(S)) {
      expect(contextualActionsFor(status)).toEqual([]);
    }
  });
});

describe("decision categories (Story 2.11, ADR-016)", () => {
  it("limits permanent disqualification to EXACTLY the three ADR-016 categories", () => {
    expect(Object.keys(DISQUALIFICATION_CATEGORIES).sort()).toEqual([
      "PERMANENT_POSSESSION_BAN",
      "PROGRAM_FRAUD",
      "PROGRAM_VIOLENCE",
    ]);
    for (const category of Object.keys(
      DISQUALIFICATION_CATEGORIES,
    ) as (keyof typeof DISQUALIFICATION_CATEGORIES)[]) {
      expect(isDisqualifyingCategory(category)).toBe(true);
    }
  });

  it("keeps every ordinary category non-disqualifying", () => {
    for (const category of Object.keys(
      ORDINARY_REJECTION_CATEGORIES,
    ) as (keyof typeof ORDINARY_REJECTION_CATEGORIES)[]) {
      expect(isDisqualifyingCategory(category)).toBe(false);
    }
  });

  it("rejects anything outside the approved list", () => {
    expect(isDecisionCategory("FELONY")).toBe(false);
    expect(isDecisionCategory("")).toBe(false);
    expect(isDecisionCategory("PROGRAM_FRAUD")).toBe(true);
    expect(isDecisionCategory("INTERVIEW")).toBe(true);
  });
});
