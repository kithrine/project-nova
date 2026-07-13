import {
  ActiveStatus,
  EnrollmentStatus,
  OrganizationKind,
  Role,
  TrainingEnrollmentStatus,
} from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import { certificationSatisfies } from "@/server/domain/certification";
import {
  evaluateCompatibility,
  type CompatibilityResult,
} from "@/server/domain/compatibility";
import {
  classifyQueueCandidate,
  NON_TERMINAL_MATCH_STATUSES,
  type QueueCandidateState,
} from "@/server/domain/matching-queue";
import { computeMatchingReadiness } from "@/server/domain/matching-readiness";
import { AuthorizationError, NotFoundError } from "@/server/errors/app-error";

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

export interface PairingHeader {
  participantName: string;
  organizationName: string;
  siteName: string;
  siteCapacity: number;
}

/**
 * The categorical, explainable compatibility read for one pairing
 * (Story 4.2). Coordinator decision support only —
 * placementMatch.viewCompatibility under Nova scope; shelters and
 * participants can never load it. Draft-stage details (schedule/dates)
 * arrive with 4.3's match; before that they evaluate as Unknown rather
 * than guessed. The approved-placement-restriction store does not exist
 * yet — the input is wired false, and the evaluator's fixed-sentence
 * factor (never a narrative) activates when that workflow lands.
 */
export async function evaluatePairingCompatibility(
  ctx: AuthContext,
  enrollmentId: string,
  siteId: string,
): Promise<{ header: PairingHeader; result: CompatibilityResult }> {
  if (!hasPermission(ctx, "placementMatch.viewCompatibility")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const [enrollment, site] = await Promise.all([
    prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        application: { select: { availabilityNotes: true, transportationNotes: true } },
        participant: {
          include: {
            person: { select: { legalFirstName: true, legalLastName: true } },
            certifications: {
              where: { requiredForMatching: true },
              select: { name: true, status: true, expiresOn: true },
            },
          },
        },
      },
    }),
    prisma.organizationSite.findUnique({
      where: { id: siteId },
      include: { organization: { select: { id: true, name: true } } },
    }),
  ]);
  if (!enrollment || !site) {
    throw new NotFoundError();
  }

  const [requiredTraining, completedTraining, supervisorCount] = await Promise.all([
    prisma.trainingProgram.count({
      where: {
        programId: enrollment.programId,
        status: ActiveStatus.ACTIVE,
        requiredForMatching: true,
      },
    }),
    prisma.trainingEnrollment
      .findMany({
        where: {
          programEnrollmentId: enrollment.id,
          status: TrainingEnrollmentStatus.COMPLETED,
          trainingProgram: { requiredForMatching: true, status: ActiveStatus.ACTIVE },
        },
        select: { trainingProgramId: true },
        distinct: ["trainingProgramId"],
      })
      .then((rows) => rows.length),
    prisma.membership.count({
      where: {
        organizationId: site.organization.id,
        role: Role.SHELTER_SUPERVISOR,
        status: ActiveStatus.ACTIVE,
      },
    }),
  ]);

  const result = evaluateCompatibility({
    availabilityNotes: enrollment.application.availabilityNotes,
    transportationNotes: enrollment.application.transportationNotes,
    requiredTrainingTotal: requiredTraining,
    requiredTrainingCompleted: completedTraining,
    requiredCertifications: enrollment.participant.certifications.map(
      (certification) => ({
        name: certification.name,
        satisfied: certificationSatisfies(certification),
      }),
    ),
    siteCapacity: site.capacity,
    supervisorCount,
    // Draft-stage details arrive with 4.3's match record.
    proposedSchedule: null,
    proposedStartDate: null,
    proposedEndDate: null,
    hasApprovedRestriction: false,
  });

  return {
    header: {
      participantName: `${enrollment.participant.person.legalFirstName} ${enrollment.participant.person.legalLastName}`,
      organizationName: site.organization.name,
      siteName: site.name,
      siteCapacity: site.capacity,
    },
    result,
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
