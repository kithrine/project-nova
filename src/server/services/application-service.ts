import { randomInt } from "node:crypto";

import { ApplicationStatus, DocumentStatus } from "@/generated/prisma/client";
import type { Application, DocumentType } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import {
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES } from "@/lib/documents";
import { APPLICATION_PROMPTS } from "@/features/application/prompts";
import type { DraftInput } from "@/features/application/validation";

/**
 * Application service (Stories 2.3, 2.5). Applicant-tier authorization per
 * the stories: `application.create`/`application.edit`/`application.submit`
 * resolve for any authenticated user with a Person — ownership-scoped
 * (Application.personId must belong to the requester), lifecycle-gated
 * (editing and submitting only in DRAFT). No Membership or Role is involved;
 * drafts are never visible to Operations or shelters (2.7 reads SUBMITTED
 * onward only).
 */

export const NON_TERMINAL_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.ELIGIBILITY_REVIEW,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.BACKGROUND_REVIEW,
] as const;

/** Participant-safe labels (docs/ux/content-style-guide.md); 2.6 builds the full journey. */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.DRAFT]: "In progress",
  [ApplicationStatus.SUBMITTED]: "Submitted",
  [ApplicationStatus.ELIGIBILITY_REVIEW]: "Under review",
  [ApplicationStatus.INTERVIEW]: "Under review",
  [ApplicationStatus.BACKGROUND_REVIEW]: "Under review",
  [ApplicationStatus.ACCEPTED]: "Accepted",
  [ApplicationStatus.REJECTED]: "Closed — you may apply again",
  [ApplicationStatus.DISQUALIFIED]: "Closed",
};

/** The form fields a draft may carry (completeness enforced only in 2.5). */
export const DRAFT_FIELDS = [
  "motivation",
  "workExperience",
  "animalExperience",
  "availabilityNotes",
  "transportationNotes",
] as const;

export interface ApplicationView {
  id: string;
  applicationNumber: string;
  status: ApplicationStatus;
  statusLabel: string;
  motivation: string | null;
  workExperience: string | null;
  animalExperience: string | null;
  availabilityNotes: string | null;
  transportationNotes: string | null;
  /** Filled-field progress for the step card (0–100). */
  progressPercent: number;
  /** Optimistic-concurrency token for draft saves. */
  updatedAtToken: string;
  /** Human-friendly submission date, e.g. "July 11, 2026" (journey view, 2.6). */
  submittedAtLabel: string | null;
}

/** Pure: what may this person do next, given their application history? */
export type ApplicationGateway =
  | { kind: "resume-draft" }
  | { kind: "in-review" }
  | { kind: "can-apply"; reapplying: boolean }
  | { kind: "blocked" };

export function resolveApplicationGateway(
  history: readonly { status: ApplicationStatus }[],
): ApplicationGateway {
  if (history.some((a) => a.status === ApplicationStatus.DISQUALIFIED)) {
    return { kind: "blocked" };
  }
  if (history.some((a) => a.status === ApplicationStatus.DRAFT)) {
    return { kind: "resume-draft" };
  }
  if (
    history.some((a) =>
      (NON_TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(a.status),
    )
  ) {
    return { kind: "in-review" };
  }
  return {
    kind: "can-apply",
    reapplying: history.some((a) => a.status === ApplicationStatus.REJECTED),
  };
}

/** Pure: shape an Application into the applicant's own view. */
export function toApplicationView(application: Application): ApplicationView {
  const filled = DRAFT_FIELDS.filter((field) => {
    const value = application[field];
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  return {
    id: application.id,
    applicationNumber: application.applicationNumber,
    status: application.status,
    statusLabel: APPLICATION_STATUS_LABELS[application.status],
    motivation: application.motivation,
    workExperience: application.workExperience,
    animalExperience: application.animalExperience,
    availabilityNotes: application.availabilityNotes,
    transportationNotes: application.transportationNotes,
    progressPercent: Math.round((filled / DRAFT_FIELDS.length) * 100),
    updatedAtToken: application.updatedAt.toISOString(),
    submittedAtLabel: application.submittedAt
      ? application.submittedAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null,
  };
}

/**
 * Human-facing application number (database-design.md). Unambiguous
 * alphabet (no 0/O/1/I); uniqueness backstopped by the DB constraint with
 * retry in the caller.
 */
export function generateApplicationNumber(year = new Date().getFullYear()): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return `APP-${year}-${suffix}`;
}

async function requireOwnPersonId(ctx: AuthContext): Promise<string> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { id: true },
  });
  if (!person) {
    // Onboarding (2.2) is the prerequisite for applying.
    throw new NotFoundError("Complete your account setup before starting an application.");
  }
  return person.id;
}

/** The requester's own application history (all records, newest first). */
export async function getOwnApplications(ctx: AuthContext): Promise<ApplicationView[]> {
  const personId = await requireOwnPersonId(ctx);
  const applications = await prisma.application.findMany({
    where: { personId },
    orderBy: { createdAt: "desc" },
  });
  return applications.map(toApplicationView);
}

/**
 * Start a new draft, or resume the existing non-terminal application.
 * Blocked permanently after a DISQUALIFIED record (2.11 sets that status;
 * this story enforces the gate).
 */
export async function startOrResumeApplication(ctx: AuthContext): Promise<ApplicationView> {
  const personId = await requireOwnPersonId(ctx);
  const history = await prisma.application.findMany({
    where: { personId },
    orderBy: { createdAt: "desc" },
  });

  const gateway = resolveApplicationGateway(history);
  if (gateway.kind === "blocked") {
    throw new LifecycleError(
      "A new application can't be started on this account. If you have questions, please contact Project Nova.",
    );
  }
  const active = history.find((a) =>
    (NON_TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(a.status),
  );
  if (active) {
    return toApplicationView(active);
  }

  // Retry on the vanishingly small application-number collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.application.create({
        data: { personId, applicationNumber: generateApplicationNumber() },
      });
      return toApplicationView(created);
    } catch (error) {
      const code = (error as { code?: string; meta?: { target?: string[] } }).code;
      const target = (error as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (code === "P2002" && target.includes("applicationNumber")) {
        continue; // number collision — regenerate
      }
      if (code === "P2002") {
        // Partial unique index: an active application won the race — resume it.
        const winner = await prisma.application.findFirst({
          where: { personId, status: { in: [...NON_TERMINAL_STATUSES] } },
        });
        if (winner) return toApplicationView(winner);
      }
      throw error;
    }
  }
  throw new ConflictError("We couldn't start your application. Please try again.");
}

/**
 * Save partial draft content. Ownership + DRAFT lifecycle gate + optimistic
 * concurrency: a stale token (another tab or device saved first) is rejected
 * with a Conflict so nothing is silently overwritten.
 */
export async function saveDraft(
  ctx: AuthContext,
  applicationId: string,
  input: DraftInput,
  expectedUpdatedAtToken: string,
): Promise<ApplicationView> {
  const personId = await requireOwnPersonId(ctx);

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  // Ownership: a client-supplied id for someone else's record is a plain 404 —
  // existence is not confirmed to non-owners.
  if (!application || application.personId !== personId) {
    throw new NotFoundError();
  }
  if (application.status !== ApplicationStatus.DRAFT) {
    throw new LifecycleError(
      "This application has been submitted, so the form can no longer be edited.",
    );
  }

  const result = await prisma.application.updateMany({
    where: { id: applicationId, updatedAt: new Date(expectedUpdatedAtToken) },
    data: {
      motivation: input.motivation ?? null,
      workExperience: input.workExperience ?? null,
      animalExperience: input.animalExperience ?? null,
      availabilityNotes: input.availabilityNotes ?? null,
      transportationNotes: input.transportationNotes ?? null,
    },
  });
  if (result.count === 0) {
    throw new ConflictError(
      "This draft was updated somewhere else (another tab or device). Reload to see the latest version — your other changes are safe.",
    );
  }

  const saved = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  return toApplicationView(saved);
}

// --- Submission (Story 2.5) --------------------------------------------------

/** One thing still standing between a draft and submission. */
export interface MissingSubmissionItem {
  kind: "field" | "document";
  /** The label exactly as the applicant sees it on the form or checklist. */
  label: string;
  message: string;
  /** In-page anchor id of the control that resolves this item. */
  anchor: string;
}

/**
 * Pure completeness check: every form answer filled in, every required
 * document uploaded. Evaluated against the SAVED draft and its ACTIVE
 * documents — stored truth, never client-supplied form data.
 */
export function missingSubmissionItems(
  application: ApplicationView,
  activeDocumentTypes: readonly DocumentType[],
): MissingSubmissionItem[] {
  const items: MissingSubmissionItem[] = [];
  for (const prompt of APPLICATION_PROMPTS) {
    const value = application[prompt.name];
    if (typeof value !== "string" || value.trim().length === 0) {
      items.push({
        kind: "field",
        label: prompt.label,
        message: "This answer is still blank — a sentence or two is plenty.",
        anchor: prompt.name,
      });
    }
  }
  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    if (!activeDocumentTypes.includes(documentType)) {
      items.push({
        kind: "document",
        label: DOCUMENT_TYPE_LABELS[documentType],
        message: "This document still needs to be uploaded.",
        anchor: `upload-${documentType}`,
      });
    }
  }
  return items;
}

/**
 * Submit a complete draft: DRAFT -> SUBMITTED, stamp submittedAt, and write
 * the lifecycle event — all in ONE transaction, so no partial submission can
 * exist (AC5). The status + concurrency token in the UPDATE's WHERE clause
 * make a replayed submit (stale tab) a lifecycle error and a concurrent edit
 * a conflict, never a duplicate (AC4/AC6). After this, the applicant's form
 * is frozen; only Operations-initiated requests (2.8) or document
 * replacement (2.4) add information.
 */
export async function submitApplication(
  ctx: AuthContext,
  applicationId: string,
  expectedUpdatedAtToken: string,
): Promise<ApplicationView> {
  const personId = await requireOwnPersonId(ctx);

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.personId !== personId) {
    throw new NotFoundError();
  }
  if (application.status !== ApplicationStatus.DRAFT) {
    throw new LifecycleError(
      "This application has already been submitted — there's nothing more you need to send.",
    );
  }

  const activeDocuments = await prisma.document.findMany({
    where: { applicationId, status: DocumentStatus.ACTIVE },
    select: { documentType: true },
  });
  const missing = missingSubmissionItems(
    toApplicationView(application),
    activeDocuments.map((d) => d.documentType),
  );
  if (missing.length > 0) {
    throw new ValidationError(
      "Your application isn't quite complete. Finish the items listed on the page, then submit.",
    );
  }

  const submitted = await prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: {
        id: applicationId,
        status: ApplicationStatus.DRAFT,
        updatedAt: new Date(expectedUpdatedAtToken),
      },
      data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
    });
    if (result.count === 0) {
      // Atomic compare-and-set failed: either another request submitted
      // first (lifecycle) or another tab saved newer content (conflict).
      const current = await tx.application.findUniqueOrThrow({
        where: { id: applicationId },
      });
      if (current.status !== ApplicationStatus.DRAFT) {
        throw new LifecycleError(
          "This application has already been submitted — there's nothing more you need to send.",
        );
      }
      throw new ConflictError(
        "This application was updated somewhere else (another tab or device). Review the latest version, then submit.",
      );
    }
    await tx.applicationEvent.create({
      data: {
        applicationId,
        fromStatus: ApplicationStatus.DRAFT,
        toStatus: ApplicationStatus.SUBMITTED,
        actorUserId: ctx.userId,
      },
    });
    return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
  });

  return toApplicationView(submitted);
}
