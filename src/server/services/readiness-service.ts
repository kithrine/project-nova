import { ActiveStatus, EnrollmentStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  computeMatchingReadiness,
  type MatchingReadiness,
} from "@/server/domain/matching-readiness";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
} from "@/server/errors/app-error";

/**
 * Matching-readiness reads (Story 3.6). One pure policy
 * (computeMatchingReadiness), two scoped callers: the coordinator's
 * enrollment workspace and the participant's own dashboard. Evaluated
 * against LIVE state on every call — never cached — so a completion or an
 * overnight certification expiry is reflected immediately (AC on
 * recompute-on-demand). The same evaluation becomes 3.7's transition gate.
 */

/**
 * Load the live rows computeMatchingReadiness evaluates. Exported for the
 * placement-activation aggregation (Story 5.5): three of the activation
 * prerequisites are exactly the 3.6 readiness sources, so both features
 * read them through this one loader.
 */
export async function loadReadinessInputs(
  db: Prisma.TransactionClient,
  enrollment: {
    id: string;
    participantId: string;
    programId: string;
  },
) {
  const [tasks, trainingPrograms, trainingAttempts, certifications] = await Promise.all([
    db.onboardingTask.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, title: true, required: true, status: true },
    }),
    db.trainingProgram.findMany({
      where: { programId: enrollment.programId, status: ActiveStatus.ACTIVE },
      select: { id: true, name: true, requiredForMatching: true },
    }),
    db.trainingEnrollment.findMany({
      where: { programEnrollmentId: enrollment.id },
      select: { trainingProgramId: true, status: true },
    }),
    db.certification.findMany({
      where: { participantId: enrollment.participantId },
      select: {
        id: true,
        name: true,
        requiredForMatching: true,
        status: true,
        expiresOn: true,
      },
    }),
  ]);
  return { tasks, trainingPrograms, trainingAttempts, certifications };
}

/** Coordinator view: the enrollment workspace's Blocker List (AC4). */
export async function getEnrollmentReadiness(
  ctx: AuthContext,
  enrollmentId: string,
): Promise<MatchingReadiness> {
  // The enrollment surface's established gate (application.view + Nova
  // scope, per enrollment-service): the spec's "coordinator view" intent.
  if (!hasPermission(ctx, "application.view")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, participantId: true, programId: true },
  });
  if (!enrollment) {
    throw new NotFoundError();
  }
  return computeMatchingReadiness(await loadReadinessInputs(prisma, enrollment));
}

export interface OwnReadinessItem {
  /** Plain-language line: what still needs doing (AC5). */
  label: string;
  kind: "task" | "training" | "certification";
}

export interface OwnReadinessView {
  ready: boolean;
  items: OwnReadinessItem[];
}

/**
 * Participant view: ownership-scoped through Person -> Participant, with
 * respectful plain-language copy and no internal codes or coordinator
 * detail (AC5). Null when the person has no enrollment yet.
 */
export async function getOwnReadiness(ctx: AuthContext): Promise<OwnReadinessView | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;

  const enrollment = await prisma.programEnrollment.findFirst({
    where: {
      participantId: person.participant.id,
      status: { in: [EnrollmentStatus.ONBOARDING, EnrollmentStatus.READY_FOR_MATCHING] },
    },
    orderBy: { enrolledAt: "desc" },
    select: { id: true, participantId: true, programId: true },
  });
  if (!enrollment) return null;

  const readiness = computeMatchingReadiness(await loadReadinessInputs(prisma, enrollment));
  return {
    ready: readiness.ready,
    items: readiness.blockers.map((blocker) => ({
      kind: blocker.kind,
      label:
        blocker.kind === "task"
          ? `Finish: ${blocker.label}`
          : blocker.kind === "training"
            ? `Complete training: ${blocker.label}`
            : `Renew: ${blocker.label} (it has expired)`,
    })),
  };
}

/**
 * The Training -> Ready for Matching transition (Story 3.7). Action-based
 * and gated, never a status dropdown: the 3.6 blocker policy re-evaluates
 * INSIDE the transaction against live rows, so a client that believes it is
 * clear cannot slip a stale readiness past the server (AC2). The
 * compare-and-set makes a repeated or racing transition a conflict, never a
 * duplicate (AC3); the lifecycle event and audit event commit atomically
 * with the status change (AC1). Reaching Ready for Matching creates no
 * Placement objects (ADR-002) — Epic 4 consumes readiness from here.
 */
export async function markReadyForMatching(
  ctx: AuthContext,
  enrollmentId: string,
): Promise<void> {
  if (!hasPermission(ctx, "enrollment.markReadyForMatching")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, participantId: true, programId: true, status: true },
  });
  if (!enrollment) {
    throw new NotFoundError();
  }
  if (enrollment.status === EnrollmentStatus.READY_FOR_MATCHING) {
    throw new LifecycleError("This enrollment is already marked ready for matching.");
  }
  if (enrollment.status !== EnrollmentStatus.ONBOARDING) {
    throw new LifecycleError(
      "Only an onboarding enrollment can be marked ready for matching.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const readiness = computeMatchingReadiness(await loadReadinessInputs(tx, enrollment));
    if (!readiness.ready) {
      const names = readiness.blockers.map((blocker) => blocker.label).join("; ");
      throw new LifecycleError(
        `This enrollment isn't ready for matching yet. Outstanding: ${names}.`,
      );
    }
    const result = await tx.programEnrollment.updateMany({
      where: { id: enrollment.id, status: EnrollmentStatus.ONBOARDING },
      data: { status: EnrollmentStatus.READY_FOR_MATCHING },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "This enrollment changed while you were working. Review the latest state.",
      );
    }
    await tx.enrollmentEvent.create({
      data: {
        enrollmentId: enrollment.id,
        fromStatus: EnrollmentStatus.ONBOARDING,
        toStatus: EnrollmentStatus.READY_FOR_MATCHING,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "enrollment.markReadyForMatching",
        subjectType: "ProgramEnrollment",
        subjectId: enrollment.id,
      },
    });
  });
}
