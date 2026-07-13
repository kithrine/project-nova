import { ActiveStatus, EnrollmentStatus, OrganizationKind } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  classifyQueueCandidate,
  NON_TERMINAL_MATCH_STATUSES,
  type QueueCandidateState,
} from "@/server/domain/matching-queue";
import { computeMatchingReadiness } from "@/server/domain/matching-readiness";
import { AuthorizationError } from "@/server/errors/app-error";

/**
 * Matching queue reads (Story 4.1). A coordinator worklist, not a public
 * listing: READY_FOR_MATCHING enrollments classified against their match
 * state (the one-non-terminal-match rule), alongside host organizations
 * with site capacity. Nova-scoped — the queue spans all shelters.
 * Placement-based exclusion activates when the Placement model lands
 * (4.8/Epic 5); the domain rule already accepts it.
 */

function requireQueueAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "placementMatch.viewQueue")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

export interface QueueCandidateView {
  enrollmentId: string;
  participantId: string;
  participantName: string;
  programName: string;
  readySinceLabel: string;
  waitingDays: number;
  /** The applicant's own availability words, surfaced for scheduling fit. */
  availability: string | null;
  state: QueueCandidateState;
  /** Blockers that re-emerged since readiness (e.g. an expired credential). */
  blockerLabels: string[];
}

export interface QueueHostSiteView {
  id: string;
  name: string;
  capacity: number;
}

export interface QueueHostView {
  organizationId: string;
  name: string;
  sites: QueueHostSiteView[];
}

export interface MatchingQueueView {
  candidates: QueueCandidateView[];
  hosts: QueueHostView[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function getMatchingQueue(ctx: AuthContext): Promise<MatchingQueueView> {
  requireQueueAccess(ctx);

  const [enrollments, hosts] = await Promise.all([
    prisma.programEnrollment.findMany({
      where: { status: EnrollmentStatus.READY_FOR_MATCHING },
      include: {
        program: { select: { name: true } },
        application: { select: { availabilityNotes: true } },
        participant: {
          include: {
            person: { select: { legalFirstName: true, legalLastName: true } },
            placementMatches: {
              where: { status: { in: [...NON_TERMINAL_MATCH_STATUSES] } },
              select: { id: true },
            },
          },
        },
        events: {
          where: { toStatus: EnrollmentStatus.READY_FOR_MATCHING },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.organization.findMany({
      where: { kind: OrganizationKind.HOST, status: ActiveStatus.ACTIVE },
      include: {
        sites: {
          where: { status: ActiveStatus.ACTIVE, capacity: { gt: 0 } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, capacity: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = Date.now();
  const candidates: QueueCandidateView[] = [];
  for (const enrollment of enrollments) {
    const state = classifyQueueCandidate({
      hasNonTerminalMatch: enrollment.participant.placementMatches.length > 0,
      // Placement model arrives with 4.8/Epic 5.
      hasBlockingPlacement: false,
    });
    if (state === "EXCLUDED") continue;

    // Blockers carried over from 3.6 — readiness can regress (an expired
    // certification) after the enrollment was marked ready.
    const readiness = computeMatchingReadiness(
      await loadQueueReadinessInputs(enrollment.id, enrollment.participantId, enrollment.programId),
    );

    const readySince = enrollment.events[0]?.createdAt ?? enrollment.updatedAt;
    candidates.push({
      enrollmentId: enrollment.id,
      participantId: enrollment.participantId,
      participantName: `${enrollment.participant.person.legalFirstName} ${enrollment.participant.person.legalLastName}`,
      programName: enrollment.program.name,
      readySinceLabel: formatDate(readySince),
      waitingDays: Math.max(0, Math.floor((now - readySince.getTime()) / 86_400_000)),
      availability: enrollment.application.availabilityNotes,
      state,
      blockerLabels: readiness.blockers.map((blocker) => blocker.label),
    });
  }

  // Longest-waiting first — the coordinator's default worklist order.
  candidates.sort((a, b) => b.waitingDays - a.waitingDays);

  return {
    candidates,
    hosts: hosts
      .filter((host) => host.sites.length > 0)
      .map((host) => ({
        organizationId: host.id,
        name: host.name,
        sites: host.sites,
      })),
  };
}

async function loadQueueReadinessInputs(
  enrollmentId: string,
  participantId: string,
  programId: string,
) {
  const [tasks, trainingPrograms, trainingAttempts, certifications] = await Promise.all([
    prisma.onboardingTask.findMany({
      where: { enrollmentId },
      select: { id: true, title: true, required: true, status: true },
    }),
    prisma.trainingProgram.findMany({
      where: { programId, status: ActiveStatus.ACTIVE },
      select: { id: true, name: true, requiredForMatching: true },
    }),
    prisma.trainingEnrollment.findMany({
      where: { programEnrollmentId: enrollmentId },
      select: { trainingProgramId: true, status: true },
    }),
    prisma.certification.findMany({
      where: { participantId },
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
