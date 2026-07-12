import { randomInt } from "node:crypto";

import { ApplicationStatus } from "@/generated/prisma/client";
import type { Application } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import {
  ConflictError,
  LifecycleError,
  NotFoundError,
} from "@/server/errors/app-error";
import type { DraftInput } from "@/features/application/validation";

/**
 * Application service (Story 2.3). Applicant-tier authorization per the
 * story: `application.create`/`application.edit` resolve for any
 * authenticated user with a Person — ownership-scoped (Application.personId
 * must belong to the requester), lifecycle-gated (editing only in DRAFT).
 * No Membership or Role is involved; drafts are never visible to Operations
 * or shelters (2.7 reads SUBMITTED onward only).
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
