import { describe, expect, it } from "vitest";

import { ApplicationStatus } from "@/generated/prisma/client";
import {
  compareQueueEntries,
  contextualActionsFor,
  OPERATIONS_STATUS_LABELS,
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

describe("contextualActionsFor (entry points only — 2.8–2.11 mechanics)", () => {
  it("offers phase-appropriate entry points for every in-flight phase", () => {
    expect(contextualActionsFor(S.SUBMITTED).map((a) => a.label)).toEqual([
      "Begin Eligibility Review",
    ]);
    expect(contextualActionsFor(S.INTERVIEW).length).toBeGreaterThan(0);
    expect(contextualActionsFor(S.BACKGROUND_REVIEW).map((a) => a.label)).toContain(
      "Reject Application",
    );
  });

  it("offers nothing for decided applications or drafts", () => {
    for (const status of [S.ACCEPTED, S.REJECTED, S.DISQUALIFIED, S.DRAFT]) {
      expect(contextualActionsFor(status)).toEqual([]);
    }
  });
});
