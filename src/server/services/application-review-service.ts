import {
  ApplicationStatus,
  BackgroundOutcome,
  EligibilityOutcome,
  InterviewFormat,
  InterviewOutcome,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import {
  hasNovaScope,
  hasPermission,
  requireLifecycleState,
  requireNovaScope,
  requirePermission,
  requirePrerequisites,
} from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import { recordAuditEvent } from "@/server/services/audit-service";
import { APPLICATION_PROMPTS } from "@/features/application/prompts";

/**
 * Operations-side application review surface (Story 2.7). Everything here is
 * Nova-internal: `application.view` + active Nova membership gate the queue
 * and workspace; `backgroundReview.view` separately gates restricted
 * background content (never implied by a base role), with every authorized
 * read audited; `caseNote.create` gates internal notes. Drafts are never
 * visible to Operations (2.3) — the queue reads SUBMITTED onward only.
 * This story reads and navigates; it performs no lifecycle transitions
 * (those arrive with 2.8–2.11).
 */

/** Internal staff-facing labels — real phase names, unlike 2.6's simplified stages. */
export const OPERATIONS_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.DRAFT]: "Draft",
  [ApplicationStatus.SUBMITTED]: "Submitted",
  [ApplicationStatus.ELIGIBILITY_REVIEW]: "Eligibility review",
  [ApplicationStatus.INTERVIEW]: "Interview",
  [ApplicationStatus.BACKGROUND_REVIEW]: "Background review",
  [ApplicationStatus.ACCEPTED]: "Accepted",
  [ApplicationStatus.REJECTED]: "Rejected",
  [ApplicationStatus.DISQUALIFIED]: "Disqualified",
};

/** Statuses Operations may see — never DRAFT (2.3's privacy rule). */
export const QUEUE_VISIBLE_STATUSES = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.ELIGIBILITY_REVIEW,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.BACKGROUND_REVIEW,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.DISQUALIFIED,
] as const;

/** Needs-attention ordering: submitted and in-review first, decided last. */
const QUEUE_RANK: Record<ApplicationStatus, number> = {
  [ApplicationStatus.SUBMITTED]: 0,
  [ApplicationStatus.ELIGIBILITY_REVIEW]: 1,
  [ApplicationStatus.INTERVIEW]: 2,
  [ApplicationStatus.BACKGROUND_REVIEW]: 3,
  [ApplicationStatus.ACCEPTED]: 4,
  [ApplicationStatus.REJECTED]: 5,
  [ApplicationStatus.DISQUALIFIED]: 6,
  [ApplicationStatus.DRAFT]: 99, // never visible; ranked defensively
};

export type QueueFilter = ApplicationStatus | "all";

/** Parse a status filter from the URL; anything invalid (including DRAFT) is "all". */
export function resolveQueueFilter(param: string | undefined): QueueFilter {
  if (
    param &&
    (QUEUE_VISIBLE_STATUSES as readonly string[]).includes(param)
  ) {
    return param as ApplicationStatus;
  }
  return "all";
}

export interface QueueEntry {
  id: string;
  applicationNumber: string;
  applicantName: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAtLabel: string | null;
  /** ISO sort key — oldest submission waits longest, so it comes first. */
  submittedAtIso: string | null;
}

/** Pure: needs-attention first, then oldest submission first within a group. */
export function compareQueueEntries(
  a: Pick<QueueEntry, "status" | "submittedAtIso">,
  b: Pick<QueueEntry, "status" | "submittedAtIso">,
): number {
  const rank = QUEUE_RANK[a.status] - QUEUE_RANK[b.status];
  if (rank !== 0) return rank;
  return (a.submittedAtIso ?? "9999").localeCompare(b.submittedAtIso ?? "9999");
}

function formatDate(date: Date | null): string | null {
  return date
    ? date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
}

function requireOperationsAccess(ctx: AuthContext): void {
  requirePermission(ctx, "application.view");
  requireNovaScope(ctx);
}

/** The Operations queue (AC1): Nova-scoped, filterable, needs-attention first. */
export async function listApplicationsForOperations(
  ctx: AuthContext,
  filter: QueueFilter = "all",
): Promise<QueueEntry[]> {
  requireOperationsAccess(ctx);

  const applications = await prisma.application.findMany({
    where: {
      status: filter === "all" ? { in: [...QUEUE_VISIBLE_STATUSES] } : filter,
    },
    include: { person: { select: { legalFirstName: true, legalLastName: true } } },
  });

  return applications
    .map((application) => ({
      id: application.id,
      applicationNumber: application.applicationNumber,
      applicantName: `${application.person.legalFirstName} ${application.person.legalLastName}`,
      status: application.status,
      statusLabel: OPERATIONS_STATUS_LABELS[application.status],
      submittedAtLabel: formatDate(application.submittedAt),
      submittedAtIso: application.submittedAt?.toISOString() ?? null,
    }))
    .sort(compareQueueEntries);
}

// --- Workspace ---------------------------------------------------------------

export const WORKSPACE_TABS = [
  "overview",
  "documents",
  "eligibility",
  "interview",
  "background",
  "history",
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: "Overview",
  documents: "Documents",
  eligibility: "Eligibility",
  interview: "Interview",
  background: "Background",
  history: "History",
};

/** Parse the workspace tab from the URL; anything invalid is Overview. */
export function resolveWorkspaceTab(param: string | undefined): WorkspaceTab {
  return (WORKSPACE_TABS as readonly string[]).includes(param ?? "")
    ? (param as WorkspaceTab)
    : "overview";
}

export interface ContextualAction {
  label: string;
  /** The story whose workflow enables this action. */
  arrivesWith: string;
}

/**
 * Phase-appropriate entry points for review workflows that are not yet
 * built. Every Epic 2 workflow is live (2.8–2.11 render through their own
 * panels), so this returns nothing today — later epics' workspace actions
 * (e.g. enrollment handoffs) plug in here.
 */
export function contextualActionsFor(_status: ApplicationStatus): ContextualAction[] {
  void _status;
  return [];
}

export interface WorkspaceView {
  id: string;
  applicationNumber: string;
  applicantName: string;
  status: ApplicationStatus;
  statusLabel: string;
  submittedAtLabel: string | null;
  createdAtLabel: string;
  answers: { label: string; value: string | null }[];
  actions: ContextualAction[];
}

async function loadVisibleApplication(ctx: AuthContext, applicationId: string) {
  requireOperationsAccess(ctx);
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { person: { select: { legalFirstName: true, legalLastName: true } } },
  });
  // Missing AND draft applications are the same plain 404 to Operations —
  // a draft's existence is not confirmed (2.3's privacy rule).
  if (!application || application.status === ApplicationStatus.DRAFT) {
    throw new NotFoundError();
  }
  return application;
}

/** The workspace (AC2): entity header data, full internal status, answers. */
export async function getApplicationWorkspace(
  ctx: AuthContext,
  applicationId: string,
): Promise<WorkspaceView> {
  const application = await loadVisibleApplication(ctx, applicationId);
  return {
    id: application.id,
    applicationNumber: application.applicationNumber,
    applicantName: `${application.person.legalFirstName} ${application.person.legalLastName}`,
    status: application.status,
    statusLabel: OPERATIONS_STATUS_LABELS[application.status],
    submittedAtLabel: formatDate(application.submittedAt),
    createdAtLabel: formatDate(application.createdAt) ?? "",
    answers: APPLICATION_PROMPTS.map((prompt) => ({
      label: prompt.label,
      value: application[prompt.name],
    })),
    actions: contextualActionsFor(application.status),
  };
}

export interface HistoryEntry {
  id: string;
  fromLabel: string;
  toLabel: string;
  atLabel: string;
  actorName: string;
}

/** The History tab: the full lifecycle event trail (exactly what 2.6 hides). */
export async function getApplicationHistory(
  ctx: AuthContext,
  applicationId: string,
): Promise<HistoryEntry[]> {
  await loadVisibleApplication(ctx, applicationId);

  const events = await prisma.applicationEvent.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.actorUserId))] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(actors.map((a) => [a.id, a.displayName]));

  return events.map((event) => ({
    id: event.id,
    fromLabel: OPERATIONS_STATUS_LABELS[event.fromStatus],
    toLabel: OPERATIONS_STATUS_LABELS[event.toStatus],
    atLabel: event.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    actorName: nameById.get(event.actorUserId) ?? "Unknown user",
  }));
}

// --- Internal notes (Nova Operations only, AC6) -------------------------------

export interface CaseNoteView {
  id: string;
  authorName: string;
  body: string;
  atLabel: string;
}

export async function listCaseNotes(
  ctx: AuthContext,
  applicationId: string,
): Promise<CaseNoteView[]> {
  await loadVisibleApplication(ctx, applicationId);

  const notes = await prisma.caseNote.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(notes.map((n) => n.authorUserId))] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.displayName]));

  return notes.map((note) => ({
    id: note.id,
    authorName: nameById.get(note.authorUserId) ?? "Unknown user",
    body: note.body,
    atLabel: note.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  }));
}

export async function addCaseNote(
  ctx: AuthContext,
  applicationId: string,
  body: string,
): Promise<CaseNoteView> {
  requirePermission(ctx, "caseNote.create");
  requireNovaScope(ctx);
  await loadVisibleApplication(ctx, applicationId);

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Write the note before saving it.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep notes under 4,000 characters.");
  }

  const note = await prisma.caseNote.create({
    data: { applicationId, authorUserId: ctx.userId, body: trimmed },
  });
  return {
    id: note.id,
    authorName: ctx.displayName,
    body: note.body,
    atLabel: note.createdAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

// --- Terminal decisions (Story 2.11; ADR-016) ---------------------------------

export {
  DISQUALIFICATION_CATEGORIES,
  ORDINARY_REJECTION_CATEGORIES,
  isDecisionCategory,
  isDisqualifyingCategory,
} from "@/features/review/decision-categories";
import {
  isDecisionCategory,
  isDisqualifyingCategory,
  type DecisionCategory,
} from "@/features/review/decision-categories";
export type { DecisionCategory } from "@/features/review/decision-categories";

/** Statuses a decision may act on: non-terminal and never DRAFT (invisible to Operations). */
const DECIDABLE_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.ELIGIBILITY_REVIEW,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.BACKGROUND_REVIEW,
];

const TERMINAL_MESSAGE =
  "This application has already been decided — terminal applications are never reopened.";

/**
 * The shared rejection mechanics, composable into a caller's transaction —
 * 2.8/2.9/2.10 invoke this on a negative outcome so their own record update
 * and the rejection commit atomically. Status change, lifecycle event,
 * Person marker (DQ only), and audit event; the compare-and-set on the
 * loaded status makes a racing decision a conflict, never a double
 * transition.
 */
async function applyRejectionInTx(
  tx: Prisma.TransactionClient,
  application: { id: string; status: ApplicationStatus; personId: string },
  category: DecisionCategory,
  actorUserId: string,
): Promise<void> {
  const disqualifying = isDisqualifyingCategory(category);
  const targetStatus = disqualifying
    ? ApplicationStatus.DISQUALIFIED
    : ApplicationStatus.REJECTED;

  const result = await tx.application.updateMany({
    where: { id: application.id, status: application.status },
    data: {
      status: targetStatus,
      decidedAt: new Date(),
      decisionReason: category,
    },
  });
  if (result.count === 0) {
    // Another decision or transition won the race.
    throw new ConflictError(
      "This application changed while you were deciding. Review the latest state, then decide again if still needed.",
    );
  }
  await tx.applicationEvent.create({
    data: {
      applicationId: application.id,
      fromStatus: application.status,
      toStatus: targetStatus,
      actorUserId,
    },
  });
  if (disqualifying) {
    await tx.person.update({
      where: { id: application.personId },
      data: { disqualifiedAt: new Date() },
    });
  }
  await tx.auditEvent.create({
    data: {
      actorUserId,
      action: "application.reject",
      subjectType: "Application",
      subjectId: application.id,
      detail: category,
    },
  });
}

/**
 * The shared rejection action (AC2/AC3): invoked directly here, and by
 * 2.8/2.9/2.10 via applyRejectionInTx on a negative outcome. The category
 * alone determines the terminal status — only ADR-016's three categories set
 * DISQUALIFIED and stamp the Person-level marker.
 */
export async function rejectApplication(
  ctx: AuthContext,
  applicationId: string,
  category: DecisionCategory,
): Promise<void> {
  requirePermission(ctx, "application.reject");
  requireNovaScope(ctx);
  if (!isDecisionCategory(category)) {
    throw new ValidationError("Choose a decision reason from the approved list.");
  }

  const application = await loadVisibleApplication(ctx, applicationId);
  if (!DECIDABLE_STATUSES.includes(application.status)) {
    throw new LifecycleError(TERMINAL_MESSAGE);
  }

  await prisma.$transaction(async (tx) =>
    applyRejectionInTx(tx, application, category, ctx.userId),
  );
}

// --- Eligibility review (Story 2.8; ADR-015) -----------------------------------

export const ELIGIBILITY_OUTCOME_LABELS: Record<EligibilityOutcome, string> = {
  [EligibilityOutcome.ELIGIBLE]: "Eligible",
  [EligibilityOutcome.NOT_ELIGIBLE]: "Not eligible",
};

export interface EligibilityReviewView {
  reviewerName: string;
  startedAtLabel: string;
  outcome: EligibilityOutcome | null;
  outcomeLabel: string | null;
  /** Internal operational record — never in participant or shelter payloads. */
  rationale: string | null;
  decidedAtLabel: string | null;
}

export async function getEligibilityReview(
  ctx: AuthContext,
  applicationId: string,
): Promise<EligibilityReviewView | null> {
  await loadVisibleApplication(ctx, applicationId);
  const review = await prisma.eligibilityReview.findUnique({ where: { applicationId } });
  if (!review) return null;
  const reviewer = await prisma.user.findUnique({
    where: { id: review.reviewerId },
    select: { displayName: true },
  });
  return {
    reviewerName: reviewer?.displayName ?? "Unknown user",
    startedAtLabel: formatDate(review.createdAt) ?? "",
    outcome: review.outcome,
    outcomeLabel: review.outcome ? ELIGIBILITY_OUTCOME_LABELS[review.outcome] : null,
    rationale: review.rationale,
    decidedAtLabel: formatDate(review.decidedAt),
  };
}

/**
 * Begin Eligibility Review (AC1): SUBMITTED -> ELIGIBILITY_REVIEW, creating
 * the EligibilityReview record (reviewer + start time) and the lifecycle
 * event in one transaction. Only a Nova Operations action drives this — the
 * applicant has no control once submitted.
 */
export async function beginEligibilityReview(
  ctx: AuthContext,
  applicationId: string,
): Promise<void> {
  requirePermission(ctx, "eligibilityReview.decide");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (application.status !== ApplicationStatus.SUBMITTED) {
    throw new LifecycleError(
      "Eligibility review can begin only on a submitted application.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: { id: applicationId, status: ApplicationStatus.SUBMITTED },
      data: { status: ApplicationStatus.ELIGIBILITY_REVIEW },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "This application changed while you were working. Review the latest state.",
      );
    }
    await tx.eligibilityReview.create({
      data: { applicationId, reviewerId: ctx.userId },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId,
        fromStatus: ApplicationStatus.SUBMITTED,
        toStatus: ApplicationStatus.ELIGIBILITY_REVIEW,
        actorUserId: ctx.userId,
      },
    });
  });
}

/**
 * Record the eligibility determination (AC2/AC3) against the ADR-015 intake
 * rubric — offense history is never part of eligibility. Eligible advances
 * to INTERVIEW; Not Eligible invokes the SHARED rejection action (2.11) with
 * the eligibility reason category — outcome, rationale, and the transition
 * commit in ONE transaction.
 */
export async function recordEligibilityOutcome(
  ctx: AuthContext,
  applicationId: string,
  outcome: EligibilityOutcome,
  rationale: string,
): Promise<void> {
  requirePermission(ctx, "eligibilityReview.decide");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (application.status !== ApplicationStatus.ELIGIBILITY_REVIEW) {
    throw new LifecycleError(
      "An outcome can be recorded only while eligibility review is in progress.",
    );
  }
  const review = await prisma.eligibilityReview.findUnique({ where: { applicationId } });
  if (!review) {
    throw new NotFoundError();
  }
  if (review.outcome) {
    throw new LifecycleError("This eligibility review already has an outcome.");
  }
  const trimmed = rationale.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(
      "Record the rationale for this determination against the ADR-015 rubric.",
    );
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep the rationale under 4,000 characters.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.eligibilityReview.update({
      where: { id: review.id },
      data: { outcome, rationale: trimmed, decidedAt: new Date() },
    });
    if (outcome === EligibilityOutcome.ELIGIBLE) {
      const result = await tx.application.updateMany({
        where: { id: applicationId, status: ApplicationStatus.ELIGIBILITY_REVIEW },
        data: { status: ApplicationStatus.INTERVIEW },
      });
      if (result.count === 0) {
        throw new ConflictError(
          "This application changed while you were working. Review the latest state.",
        );
      }
      await tx.applicationEvent.create({
        data: {
          applicationId,
          fromStatus: ApplicationStatus.ELIGIBILITY_REVIEW,
          toStatus: ApplicationStatus.INTERVIEW,
          actorUserId: ctx.userId,
        },
      });
    } else {
      await applyRejectionInTx(tx, application, "ELIGIBILITY", ctx.userId);
    }
  });
}

// --- Interview workflow (Story 2.9) --------------------------------------------

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  [InterviewFormat.IN_PERSON]: "In person",
  [InterviewFormat.VIRTUAL]: "Virtual",
};

export const INTERVIEW_OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  [InterviewOutcome.ADVANCE]: "Advance",
  [InterviewOutcome.DO_NOT_ADVANCE]: "Do not advance",
};

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export interface InterviewView {
  id: string;
  scheduledAtLabel: string;
  formatLabel: string;
  interviewerName: string;
  outcome: InterviewOutcome | null;
  outcomeLabel: string | null;
  /** Internal notes — never in participant or shelter payloads. */
  notes: string | null;
  /** The newest row is the current appointment; earlier rows are history. */
  isCurrent: boolean;
}

/** All appointments, newest first — rescheduling preserves prior rows (AC2). */
export async function listInterviews(
  ctx: AuthContext,
  applicationId: string,
): Promise<InterviewView[]> {
  await loadVisibleApplication(ctx, applicationId);
  const interviews = await prisma.interview.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
  const interviewers = await prisma.user.findMany({
    where: { id: { in: [...new Set(interviews.map((i) => i.interviewerId))] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(interviewers.map((u) => [u.id, u.displayName]));

  return interviews.map((interview, index) => ({
    id: interview.id,
    scheduledAtLabel: formatDateTime(interview.scheduledAt),
    formatLabel: INTERVIEW_FORMAT_LABELS[interview.format],
    interviewerName: nameById.get(interview.interviewerId) ?? "Unknown user",
    outcome: interview.outcome,
    outcomeLabel: interview.outcome ? INTERVIEW_OUTCOME_LABELS[interview.outcome] : null,
    notes: interview.notes,
    isCurrent: index === 0,
  }));
}

/**
 * Schedule (or reschedule) the interview (AC1/AC2). Rescheduling creates a
 * NEW row so the prior time stays in history. MVP records the scheduling
 * coordinator as the interviewer. The applicant's journey (2.6) surfaces
 * date/time/format only.
 */
export async function scheduleInterview(
  ctx: AuthContext,
  applicationId: string,
  scheduledAt: Date,
  format: InterviewFormat,
): Promise<void> {
  requirePermission(ctx, "interview.schedule");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (application.status !== ApplicationStatus.INTERVIEW) {
    throw new LifecycleError(
      "An interview can be scheduled only while the application is in the interview phase.",
    );
  }
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ValidationError("Choose a valid date and time for the interview.");
  }
  if (!Object.values(InterviewFormat).includes(format)) {
    throw new ValidationError("Choose an interview format from the list.");
  }

  await prisma.interview.create({
    data: {
      applicationId,
      scheduledAt,
      format,
      interviewerId: ctx.userId,
    },
  });
}

/**
 * Record the interview outcome (AC3/AC4) on the current appointment.
 * Advance transitions to BACKGROUND_REVIEW; Do Not Advance invokes the
 * SHARED rejection action (2.11) with the interview reason category —
 * outcome, notes, and the transition commit in ONE transaction. Notes and
 * the recommendation are internal-only (AC5).
 */
export async function recordInterviewOutcome(
  ctx: AuthContext,
  applicationId: string,
  outcome: InterviewOutcome,
  notes: string,
): Promise<void> {
  requirePermission(ctx, "interview.record");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (application.status !== ApplicationStatus.INTERVIEW) {
    throw new LifecycleError(
      "An outcome can be recorded only while the application is in the interview phase.",
    );
  }
  const current = await prisma.interview.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
  if (!current) {
    throw new LifecycleError("Schedule the interview before recording an outcome.");
  }
  if (current.outcome) {
    throw new LifecycleError("This interview already has a recorded outcome.");
  }
  const trimmed = notes.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Record the internal notes for this outcome.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep notes under 4,000 characters.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.interview.update({
      where: { id: current.id },
      data: { outcome, notes: trimmed, decidedAt: new Date() },
    });
    if (outcome === InterviewOutcome.ADVANCE) {
      const result = await tx.application.updateMany({
        where: { id: applicationId, status: ApplicationStatus.INTERVIEW },
        data: { status: ApplicationStatus.BACKGROUND_REVIEW },
      });
      if (result.count === 0) {
        throw new ConflictError(
          "This application changed while you were working. Review the latest state.",
        );
      }
      await tx.applicationEvent.create({
        data: {
          applicationId,
          fromStatus: ApplicationStatus.INTERVIEW,
          toStatus: ApplicationStatus.BACKGROUND_REVIEW,
          actorUserId: ctx.userId,
        },
      });
    } else {
      await applyRejectionInTx(tx, application, "INTERVIEW", ctx.userId);
    }
  });
}

// --- Background decision (Story 2.10; ADR-015/ADR-016) -------------------------

export const BACKGROUND_OUTCOME_LABELS: Record<BackgroundOutcome, string> = {
  [BackgroundOutcome.CLEAR]: "Clear",
  [BackgroundOutcome.DISQUALIFYING]: "Disqualifying",
};

/**
 * The only rejection categories a Disqualifying background outcome may
 * carry (ADR-016): ordinary "not cleared", or the single permanent case —
 * an active PERMANENT court-ordered animal-possession ban. Program-conduct
 * categories belong to the Decision Panel, not this path.
 */
export const BACKGROUND_REJECTION_CATEGORIES = [
  "BACKGROUND",
  "PERMANENT_POSSESSION_BAN",
] as const;
export type BackgroundRejectionCategory = (typeof BACKGROUND_REJECTION_CATEGORIES)[number];

export interface BackgroundReviewView {
  reviewerName: string;
  outcome: BackgroundOutcome;
  outcomeLabel: string;
  /** Highly Restricted — only ever rendered inside the audited background tab. */
  rationale: string;
  recordedAtLabel: string;
}

/**
 * The restricted internal view (AC5): requires backgroundReview.view under
 * Nova scope — denied server-side for everyone else, including Program
 * Coordinators (AC2). Callers render it only inside the audited tab gate.
 */
export async function getBackgroundReview(
  ctx: AuthContext,
  applicationId: string,
): Promise<BackgroundReviewView | null> {
  await loadVisibleApplication(ctx, applicationId);
  if (!hasPermission(ctx, "backgroundReview.view") || !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  const review = await prisma.backgroundReview.findUnique({ where: { applicationId } });
  if (!review) return null;
  const reviewer = await prisma.user.findUnique({
    where: { id: review.reviewerId },
    select: { displayName: true },
  });
  return {
    reviewerName: reviewer?.displayName ?? "Unknown user",
    outcome: review.outcome,
    outcomeLabel: BACKGROUND_OUTCOME_LABELS[review.outcome],
    rationale: review.rationale,
    recordedAtLabel: formatDate(review.createdAt) ?? "",
  };
}

/**
 * Record the background decision (AC1/AC3/AC4): one step, since the check
 * itself happens through an external process. CLEAR leaves the application
 * in BACKGROUND_REVIEW, now accept-eligible (never auto-accepted).
 * DISQUALIFYING invokes the SHARED rejection in the same transaction with
 * the reviewer's chosen category — ordinary BACKGROUND, or
 * PERMANENT_POSSESSION_BAN for the one ADR-016 permanent case. The decision
 * itself is audited distinctly from lifecycle events (AC6).
 */
export async function recordBackgroundDecision(
  ctx: AuthContext,
  applicationId: string,
  outcome: BackgroundOutcome,
  rationale: string,
  rejectionCategory?: BackgroundRejectionCategory,
): Promise<void> {
  requirePermission(ctx, "backgroundReview.decide");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (application.status !== ApplicationStatus.BACKGROUND_REVIEW) {
    throw new LifecycleError(
      "A background decision can be recorded only during background review.",
    );
  }
  const existing = await prisma.backgroundReview.findUnique({ where: { applicationId } });
  if (existing) {
    throw new LifecycleError("A background decision has already been recorded.");
  }
  const trimmed = rationale.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Record the restricted rationale for this decision.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep the rationale under 4,000 characters.");
  }
  if (
    outcome === BackgroundOutcome.DISQUALIFYING &&
    (!rejectionCategory || !BACKGROUND_REJECTION_CATEGORIES.includes(rejectionCategory))
  ) {
    throw new ValidationError(
      "Choose whether this is an ordinary background rejection or the permanent possession-ban case (ADR-016).",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.backgroundReview.create({
      data: {
        applicationId,
        reviewerId: ctx.userId,
        outcome,
        rationale: trimmed,
      },
    });
    // Distinct, high-sensitivity audit event for the decision itself (AC6);
    // detail carries the outcome only — never the rationale.
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "backgroundReview.decide",
        subjectType: "Application",
        subjectId: applicationId,
        detail: outcome,
      },
    });
    if (outcome === BackgroundOutcome.DISQUALIFYING && rejectionCategory) {
      await applyRejectionInTx(tx, application, rejectionCategory, ctx.userId);
    }
  });
}

/**
 * Accept's business prerequisites (2.11 AC1): a recorded CLEAR background
 * outcome, checked against the BackgroundReview record.
 */
export async function acceptPrerequisiteFailures(
  applicationId: string,
): Promise<string[]> {
  const review = await prisma.backgroundReview.findUnique({
    where: { applicationId },
    select: { outcome: true },
  });
  if (review?.outcome === BackgroundOutcome.CLEAR) {
    return [];
  }
  return ["a recorded Clear background outcome is required before acceptance"];
}

/**
 * Accept (AC1): only from BACKGROUND_REVIEW with a Clear background outcome.
 * The transaction below is the Story 3.1 handoff boundary — participant and
 * enrollment creation plug into THIS transaction so acceptance and enrollment
 * succeed together or not at all (business-rules.md).
 */
export async function acceptApplication(
  ctx: AuthContext,
  applicationId: string,
): Promise<void> {
  requirePermission(ctx, "application.accept");
  requireNovaScope(ctx);

  const application = await loadVisibleApplication(ctx, applicationId);
  if (!DECIDABLE_STATUSES.includes(application.status)) {
    throw new LifecycleError(TERMINAL_MESSAGE);
  }
  requireLifecycleState(application.status, [ApplicationStatus.BACKGROUND_REVIEW]);
  requirePrerequisites(await acceptPrerequisiteFailures(applicationId));

  await prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: { id: applicationId, status: ApplicationStatus.BACKGROUND_REVIEW },
      data: { status: ApplicationStatus.ACCEPTED, decidedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "This application changed while you were deciding. Review the latest state before accepting.",
      );
    }
    await tx.applicationEvent.create({
      data: {
        applicationId,
        fromStatus: ApplicationStatus.BACKGROUND_REVIEW,
        toStatus: ApplicationStatus.ACCEPTED,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "application.accept",
        subjectType: "Application",
        subjectId: applicationId,
      },
    });
    // Story 3.1 handoff: Participant + ProgramEnrollment creation joins this
    // transaction here (accepted application creates both transactionally).
  });
}

// --- Restricted background access (AC3/AC4) -----------------------------------

/**
 * Resolve access to the Background tab's CONTENT. The tab itself is always
 * visible; its content requires `backgroundReview.view`. Authorized access
 * is written to an AuditEvent in the same request that delivers the
 * content. Unauthorized callers get `authorized: false` — the caller
 * renders the Restricted state and no background data enters the payload.
 */
export async function openBackgroundTab(
  ctx: AuthContext,
  applicationId: string,
): Promise<{ authorized: boolean }> {
  await loadVisibleApplication(ctx, applicationId);

  if (!hasPermission(ctx, "backgroundReview.view")) {
    return { authorized: false };
  }
  await recordAuditEvent(ctx, "backgroundReview.view", "Application", applicationId);
  return { authorized: true };
}
