import { ActiveStatus, EnrollmentStatus } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  computeMatchingReadiness,
  type MatchingReadiness,
} from "@/server/domain/matching-readiness";
import { AuthorizationError, NotFoundError } from "@/server/errors/app-error";

/**
 * Matching-readiness reads (Story 3.6). One pure policy
 * (computeMatchingReadiness), two scoped callers: the coordinator's
 * enrollment workspace and the participant's own dashboard. Evaluated
 * against LIVE state on every call — never cached — so a completion or an
 * overnight certification expiry is reflected immediately (AC on
 * recompute-on-demand). The same evaluation becomes 3.7's transition gate.
 */

async function loadReadinessInputs(enrollment: {
  id: string;
  participantId: string;
  programId: string;
}) {
  const [tasks, trainingPrograms, trainingAttempts, certifications] = await Promise.all([
    prisma.onboardingTask.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, title: true, required: true, status: true },
    }),
    prisma.trainingProgram.findMany({
      where: { programId: enrollment.programId, status: ActiveStatus.ACTIVE },
      select: { id: true, name: true, requiredForMatching: true },
    }),
    prisma.trainingEnrollment.findMany({
      where: { programEnrollmentId: enrollment.id },
      select: { trainingProgramId: true, status: true },
    }),
    prisma.certification.findMany({
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
  return computeMatchingReadiness(await loadReadinessInputs(enrollment));
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

  const readiness = computeMatchingReadiness(await loadReadinessInputs(enrollment));
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
