import {
  ActiveStatus,
  EnrollmentStatus,
  MatchStatus,
  OrganizationKind,
  ParticipantMatchDecision,
  Role,
  ShelterMatchDecision,
  TrainingEnrollmentStatus,
} from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission, requireNovaScope } from "@/server/auth/authorize";
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
import {
  assertMatchTransition,
  DECISION_WINDOW_DAYS,
  decisionBlockReason,
  decisionWindowEnd,
  describePriorCycle,
  draftCreationBlockReason,
  matchStatusAfterParticipantDecision,
  matchStatusAfterShelterDecision,
  proposalMissingFields,
  shelterDecisionRequiresNote,
} from "@/server/domain/placement-match";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

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
  draft?: {
    proposedSchedule: string | null;
    proposedStartDate: Date | null;
    proposedEndDate: Date | null;
  },
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
    // Pairing-stage evaluations pass no draft; 4.3 drafts pass theirs.
    proposedSchedule: draft?.proposedSchedule ?? null,
    proposedStartDate: draft?.proposedStartDate ?? null,
    proposedEndDate: draft?.proposedEndDate ?? null,
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

// --- Match drafts (Story 4.3) ---------------------------------------------------

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  [MatchStatus.DRAFT]: "Draft",
  [MatchStatus.PROPOSED]: "Proposed",
  [MatchStatus.APPROVED]: "Approved",
  [MatchStatus.CHANGE_REQUESTED]: "Change requested",
  [MatchStatus.DECLINED]: "Declined",
  [MatchStatus.WITHDRAWN]: "Withdrawn",
  [MatchStatus.EXPIRED]: "Expired",
};

export const PARTICIPANT_DECISION_LABELS: Record<ParticipantMatchDecision, string> = {
  [ParticipantMatchDecision.PENDING]: "Pending",
  [ParticipantMatchDecision.ACCEPTED]: "Accepted",
  [ParticipantMatchDecision.DECLINED]: "Declined",
};

export const SHELTER_DECISION_LABELS: Record<ShelterMatchDecision, string> = {
  [ShelterMatchDecision.PENDING]: "Pending",
  [ShelterMatchDecision.APPROVED]: "Approved",
  [ShelterMatchDecision.CHANGE_REQUESTED]: "Change requested",
  [ShelterMatchDecision.DECLINED]: "Declined",
};

export interface StoredCompatibilitySnapshot extends CompatibilityResult {
  evaluatedAt: string;
}

function buildSnapshot(result: CompatibilityResult): string {
  return JSON.stringify({ evaluatedAt: new Date().toISOString(), ...result });
}

/** Parse a stored snapshot defensively — a bad row renders as "none". */
export function parseCompatibilitySnapshot(
  raw: string | null,
): StoredCompatibilitySnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCompatibilitySnapshot;
    return parsed && typeof parsed === "object" && Array.isArray(parsed.factors)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function requireDraftAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "placementMatch.manageDraft")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

const ONE_MATCH_MESSAGE =
  "This participant already has a match in progress (draft, proposed, or change requested) — one match at a time, per the one-placement-at-a-time rule.";

/**
 * Create a Draft match from a reviewed pairing (AC1/AC2). Prerequisites are
 * named in plain language; the partial unique index backstops the race. The
 * 4.2 result at creation time is persisted as the first snapshot, and the
 * creation lifecycle event + audit event commit with the row.
 */
export async function createMatchDraft(
  ctx: AuthContext,
  input: { enrollmentId: string; siteId: string },
): Promise<{ id: string }> {
  requireDraftAccess(ctx);

  const [enrollment, site] = await Promise.all([
    prisma.programEnrollment.findUnique({
      where: { id: input.enrollmentId },
      select: { id: true, status: true, participantId: true },
    }),
    prisma.organizationSite.findUnique({
      where: { id: input.siteId },
      include: { organization: { select: { id: true, kind: true, status: true } } },
    }),
  ]);
  if (!enrollment || !site) throw new NotFoundError();
  if (
    site.status !== ActiveStatus.ACTIVE ||
    site.organization.kind !== OrganizationKind.HOST ||
    site.organization.status !== ActiveStatus.ACTIVE
  ) {
    throw new ValidationError("Choose an active shelter site.");
  }

  const existing = await prisma.placementMatch.count({
    where: {
      participantId: enrollment.participantId,
      status: { in: [...NON_TERMINAL_MATCH_STATUSES] },
    },
  });
  const blocked = draftCreationBlockReason({
    enrollmentStatus: enrollment.status,
    hasNonTerminalMatch: existing > 0,
    hasBlockingPlacement: false, // Placement model arrives with 4.8/Epic 5.
  });
  if (blocked) {
    throw new ConflictError(blocked);
  }

  const evaluation = await evaluatePairingCompatibility(
    ctx,
    input.enrollmentId,
    input.siteId,
  );

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.placementMatch.create({
        data: {
          participantId: enrollment.participantId,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: site.organization.id,
          organizationSiteId: site.id,
          compatibilitySnapshot: buildSnapshot(evaluation.result),
        },
        select: { id: true },
      });
      await tx.placementMatchEvent.create({
        data: {
          placementMatchId: created.id,
          fromStatus: null,
          toStatus: MatchStatus.DRAFT,
          actorUserId: ctx.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: ctx.userId,
          action: "placementMatch.create",
          subjectType: "PlacementMatch",
          subjectId: created.id,
        },
      });
      return created;
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new ConflictError(ONE_MATCH_MESSAGE);
    }
    throw error;
  }
}

export interface MatchOption {
  id: string;
  label: string;
}

export interface MatchWorkspaceView {
  id: string;
  status: MatchStatus;
  statusLabel: string;
  participantName: string;
  enrollmentId: string;
  organizationName: string;
  siteId: string;
  siteName: string;
  supervisorId: string | null;
  schedule: string | null;
  startDateValue: string | null;
  endDateValue: string | null;
  fundingSourceId: string | null;
  notes: string | null;
  snapshot: StoredCompatibilitySnapshot | null;
  siteOptions: MatchOption[];
  supervisorOptions: MatchOption[];
  fundingOptions: MatchOption[];
  // Decision tracks (Stories 4.5/4.6). The participant note is
  // Operations-visible here (4.5 AC6) — it never enters shelter or
  // participant view models.
  participantDecision: ParticipantMatchDecision;
  participantDecisionLabel: string;
  participantDecisionAtLabel: string | null;
  participantDecisionNote: string | null;
  /** True when a coordinator recorded the decision on the participant's behalf. */
  participantDecisionRecordedByStaff: boolean;
  shelterDecision: ShelterMatchDecision;
  shelterDecisionLabel: string;
  shelterDecisionAtLabel: string | null;
  /** The shelter's operational note (4.6) — actionable input for 4.7. */
  shelterDecisionNote: string | null;
}

/** The coordinator draft workspace (drafts are coordinator-only, AC6). */
export async function getMatchWorkspace(
  ctx: AuthContext,
  matchId: string,
): Promise<MatchWorkspaceView> {
  requireDraftAccess(ctx);

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    include: {
      participant: {
        include: {
          person: {
            select: { legalFirstName: true, legalLastName: true, userId: true },
          },
        },
      },
      organizationSite: {
        include: { organization: { select: { id: true, name: true } } },
      },
    },
  });
  if (!match) throw new NotFoundError();

  const [sites, supervisors, funding] = await Promise.all([
    prisma.organizationSite.findMany({
      where: {
        status: ActiveStatus.ACTIVE,
        organization: { kind: OrganizationKind.HOST, status: ActiveStatus.ACTIVE },
      },
      include: { organization: { select: { name: true } } },
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.membership.findMany({
      where: {
        organizationId: match.organizationSite.organization.id,
        role: Role.SHELTER_SUPERVISOR,
        status: ActiveStatus.ACTIVE,
      },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { user: { displayName: "asc" } },
    }),
    prisma.fundingSource.findMany({
      where: { status: ActiveStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    id: match.id,
    status: match.status,
    statusLabel: MATCH_STATUS_LABELS[match.status],
    participantName: `${match.participant.person.legalFirstName} ${match.participant.person.legalLastName}`,
    enrollmentId: match.programEnrollmentId,
    organizationName: match.organizationSite.organization.name,
    siteId: match.organizationSiteId,
    siteName: match.organizationSite.name,
    supervisorId: match.proposedSupervisorId,
    schedule: match.proposedSchedule,
    startDateValue: match.proposedStartDate
      ? match.proposedStartDate.toISOString().slice(0, 10)
      : null,
    endDateValue: match.proposedEndDate
      ? match.proposedEndDate.toISOString().slice(0, 10)
      : null,
    fundingSourceId: match.candidateFundingSourceId,
    notes: match.coordinatorNotes,
    snapshot: parseCompatibilitySnapshot(match.compatibilitySnapshot),
    siteOptions: sites.map((option) => ({
      id: option.id,
      label: `${option.organization.name} — ${option.name} (capacity ${option.capacity})`,
    })),
    supervisorOptions: supervisors.map((membership) => ({
      id: membership.user.id,
      label: membership.user.displayName,
    })),
    fundingOptions: funding.map((source) => ({ id: source.id, label: source.name })),
    participantDecision: match.participantDecision,
    participantDecisionLabel: PARTICIPANT_DECISION_LABELS[match.participantDecision],
    participantDecisionAtLabel: formatWindowDate(match.participantDecisionAt),
    participantDecisionNote: match.participantDecisionNote,
    participantDecisionRecordedByStaff:
      match.participantDecisionRecordedByUserId !== null &&
      match.participantDecisionRecordedByUserId !== match.participant.person.userId,
    shelterDecision: match.shelterDecision,
    shelterDecisionLabel: SHELTER_DECISION_LABELS[match.shelterDecision],
    shelterDecisionAtLabel: formatWindowDate(match.shelterDecisionAt),
    shelterDecisionNote: match.shelterDecisionNote,
  };
}

export interface UpdateMatchDraftInput {
  siteId: string;
  supervisorId: string | null;
  schedule: string | null;
  startDate: Date | null;
  endDate: Date | null;
  fundingSourceId: string | null;
  notes: string | null;
}

/**
 * Edit a Draft (4.3 AC3) or a Change Requested match (4.7 AC2): details
 * save, the status does not move, and the compatibility snapshot
 * re-evaluates against the edited details in the same write. DRAFT edits
 * require placementMatch.manageDraft; CHANGE_REQUESTED edits require
 * placementMatch.revise — both coordinator-tier, denied before any load.
 */
export async function updateMatchDraft(
  ctx: AuthContext,
  matchId: string,
  input: UpdateMatchDraftInput,
): Promise<void> {
  if (
    !hasPermission(ctx, "placementMatch.manageDraft") &&
    !hasPermission(ctx, "placementMatch.revise")
  ) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, programEnrollmentId: true },
  });
  if (!match) throw new NotFoundError();
  if (match.status === MatchStatus.DRAFT) {
    if (!hasPermission(ctx, "placementMatch.manageDraft")) {
      throw new AuthorizationError();
    }
  } else if (match.status === MatchStatus.CHANGE_REQUESTED) {
    if (!hasPermission(ctx, "placementMatch.revise")) {
      throw new AuthorizationError();
    }
  } else {
    throw new LifecycleError("Only a draft or change-requested match can be edited.");
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new ValidationError("The end date cannot be before the start date.");
  }

  const site = await prisma.organizationSite.findUnique({
    where: { id: input.siteId },
    include: { organization: { select: { id: true, kind: true, status: true } } },
  });
  if (
    !site ||
    site.status !== ActiveStatus.ACTIVE ||
    site.organization.kind !== OrganizationKind.HOST ||
    site.organization.status !== ActiveStatus.ACTIVE
  ) {
    throw new ValidationError("Choose an active shelter site.");
  }

  const evaluation = await evaluatePairingCompatibility(
    ctx,
    match.programEnrollmentId,
    input.siteId,
    {
      proposedSchedule: input.schedule,
      proposedStartDate: input.startDate,
      proposedEndDate: input.endDate,
    },
  );

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: { id: matchId, status: match.status },
      data: {
        organizationSiteId: site.id,
        hostOrganizationId: site.organization.id,
        proposedSupervisorId: input.supervisorId,
        proposedSchedule: input.schedule,
        proposedStartDate: input.startDate,
        proposedEndDate: input.endDate,
        candidateFundingSourceId: input.fundingSourceId,
        coordinatorNotes: input.notes,
        compatibilitySnapshot: buildSnapshot(evaluation.result),
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.update",
        subjectType: "PlacementMatch",
        subjectId: matchId,
        detail:
          match.status === MatchStatus.CHANGE_REQUESTED
            ? "revision-edited"
            : "draft-edited",
      },
    });
  });
}

/**
 * Withdraw a match the coordinator no longer wants to pursue: a Draft
 * (4.3 AC5, manageDraft) or a Change Requested match (4.7 AC3, revise).
 * Withdrawing from Change Requested archives the outgoing cycle's
 * decision values and shelter note into the lifecycle event's detail —
 * prior decisions are never silently overwritten. The participant
 * reappears in the matching queue automatically (no non-terminal match).
 */
export async function withdrawMatchDraft(
  ctx: AuthContext,
  matchId: string,
): Promise<void> {
  if (
    !hasPermission(ctx, "placementMatch.manageDraft") &&
    !hasPermission(ctx, "placementMatch.revise")
  ) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      participantDecision: true,
      shelterDecision: true,
      shelterDecisionNote: true,
    },
  });
  if (!match) throw new NotFoundError();
  if (match.status === MatchStatus.DRAFT) {
    if (!hasPermission(ctx, "placementMatch.manageDraft")) {
      throw new AuthorizationError();
    }
  } else if (match.status === MatchStatus.CHANGE_REQUESTED) {
    if (!hasPermission(ctx, "placementMatch.revise")) {
      throw new AuthorizationError();
    }
  } else {
    throw new LifecycleError(
      "Only a draft or change-requested match can be withdrawn here.",
    );
  }

  const fromChangeRequested = match.status === MatchStatus.CHANGE_REQUESTED;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: { id: matchId, status: match.status },
      data: { status: MatchStatus.WITHDRAWN },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementMatchEvent.create({
      data: {
        placementMatchId: matchId,
        fromStatus: match.status,
        toStatus: MatchStatus.WITHDRAWN,
        actorUserId: ctx.userId,
        detail: fromChangeRequested
          ? describePriorCycle({
              participantDecisionLabel:
                PARTICIPANT_DECISION_LABELS[match.participantDecision],
              shelterDecisionLabel: SHELTER_DECISION_LABELS[match.shelterDecision],
              shelterDecisionNote: match.shelterDecisionNote,
            })
          : null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.withdraw",
        subjectType: "PlacementMatch",
        subjectId: matchId,
        detail: fromChangeRequested ? "withdrawn after change request" : null,
      },
    });
  });
}

/**
 * Revise-and-repropose (Story 4.7 AC2): a Change Requested match returns
 * to Proposed with BOTH decision tracks reset to Pending — the terms
 * changed, so prior consent cannot carry over. The outgoing cycle's
 * decisions and shelter note are archived in the lifecycle event's detail
 * before the row's per-cycle fields reset, and a fresh decision window is
 * stamped. Requires the same core-field completeness as 4.4.
 */
export async function reproposeMatch(ctx: AuthContext, matchId: string): Promise<void> {
  if (!hasPermission(ctx, "placementMatch.revise")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      proposedSupervisorId: true,
      proposedSchedule: true,
      proposedStartDate: true,
      proposedEndDate: true,
      participantDecision: true,
      shelterDecision: true,
      shelterDecisionNote: true,
    },
  });
  if (!match) throw new NotFoundError();
  if (match.status !== MatchStatus.CHANGE_REQUESTED) {
    throw new LifecycleError("Only a change-requested match can be re-proposed.");
  }

  const missing = proposalMissingFields(match);
  if (missing.length > 0) {
    throw new ValidationError(
      `Complete these before proposing: ${missing.join("; ")}.`,
    );
  }

  const proposedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: { id: matchId, status: MatchStatus.CHANGE_REQUESTED },
      data: {
        status: MatchStatus.PROPOSED,
        participantDecision: ParticipantMatchDecision.PENDING,
        shelterDecision: ShelterMatchDecision.PENDING,
        // Archive-then-reset: the outgoing cycle survives in the event
        // detail below; the row carries only the current cycle.
        participantDecisionAt: null,
        participantDecisionNote: null,
        participantDecisionRecordedByUserId: null,
        shelterDecisionAt: null,
        shelterDecisionNote: null,
        shelterDecisionRecordedByUserId: null,
        proposedAt,
        decisionWindowEndsAt: decisionWindowEnd(proposedAt),
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementMatchEvent.create({
      data: {
        placementMatchId: matchId,
        fromStatus: MatchStatus.CHANGE_REQUESTED,
        toStatus: MatchStatus.PROPOSED,
        actorUserId: ctx.userId,
        detail: describePriorCycle({
          participantDecisionLabel:
            PARTICIPANT_DECISION_LABELS[match.participantDecision],
          shelterDecisionLabel: SHELTER_DECISION_LABELS[match.shelterDecision],
          shelterDecisionNote: match.shelterDecisionNote,
        }),
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.repropose",
        subjectType: "PlacementMatch",
        subjectId: matchId,
        // The note itself stays out of audit detail, as everywhere.
        detail: "re-proposed after change request",
      },
    });
  });
}

export interface MatchWorklistRow {
  id: string;
  participantName: string;
  organizationName: string;
  siteName: string;
  status: MatchStatus;
  statusLabel: string;
}

/** Non-terminal matches — the coordinator in-progress worklist. */
export async function listMatchWorklist(ctx: AuthContext): Promise<MatchWorklistRow[]> {
  requireQueueAccess(ctx);
  await expireStaleProposals();
  const matches = await prisma.placementMatch.findMany({
    where: { status: { in: [...NON_TERMINAL_MATCH_STATUSES] } },
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      organizationSite: { include: { organization: { select: { name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return matches.map((match) => ({
    id: match.id,
    participantName: `${match.participant.person.legalFirstName} ${match.participant.person.legalLastName}`,
    organizationName: match.organizationSite.organization.name,
    siteName: match.organizationSite.name,
    status: match.status,
    statusLabel: MATCH_STATUS_LABELS[match.status],
  }));
}

// --- Propose match (Story 4.4) ---------------------------------------------------

/**
 * Draft -> Proposed: the moment match details first cross the organization
 * boundary (AC1). Core fields are required and missing ones NAMED (AC2);
 * both decision tracks reset to Pending; proposedAt and the decision-window
 * target are stamped; lifecycle event + audit event commit with the change.
 */
export async function proposeMatch(ctx: AuthContext, matchId: string): Promise<void> {
  if (!hasPermission(ctx, "placementMatch.propose")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      proposedSupervisorId: true,
      proposedSchedule: true,
      proposedStartDate: true,
      proposedEndDate: true,
    },
  });
  if (!match) throw new NotFoundError();
  assertMatchTransition(match.status, MatchStatus.PROPOSED);

  const missing = proposalMissingFields(match);
  if (missing.length > 0) {
    throw new ValidationError(
      `Complete these before proposing: ${missing.join("; ")}.`,
    );
  }

  const proposedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: { id: matchId, status: match.status },
      data: {
        status: MatchStatus.PROPOSED,
        participantDecision: ParticipantMatchDecision.PENDING,
        shelterDecision: ShelterMatchDecision.PENDING,
        proposedAt,
        decisionWindowEndsAt: decisionWindowEnd(proposedAt),
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementMatchEvent.create({
      data: {
        placementMatchId: matchId,
        fromStatus: match.status,
        toStatus: MatchStatus.PROPOSED,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.propose",
        subjectType: "PlacementMatch",
        subjectId: matchId,
      },
    });
  });
}

/**
 * Evaluate-on-access expiration (AC5): Proposed matches past their window
 * with BOTH tracks still Pending transition to Expired. Each expiry is its
 * own compare-and-set transaction with its lifecycle event, so a racing
 * decision (4.5/4.6) can never be overwritten.
 */
export async function expireStaleProposals(now: Date = new Date()): Promise<number> {
  const stale = await prisma.placementMatch.findMany({
    where: {
      status: MatchStatus.PROPOSED,
      decisionWindowEndsAt: { lt: now },
      participantDecision: ParticipantMatchDecision.PENDING,
      shelterDecision: ShelterMatchDecision.PENDING,
    },
    select: { id: true },
  });

  let expired = 0;
  for (const match of stale) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.placementMatch.updateMany({
        where: {
          id: match.id,
          status: MatchStatus.PROPOSED,
          participantDecision: ParticipantMatchDecision.PENDING,
          shelterDecision: ShelterMatchDecision.PENDING,
        },
        data: { status: MatchStatus.EXPIRED },
      });
      if (updated.count === 1) {
        expired += 1;
        await tx.placementMatchEvent.create({
          data: {
            placementMatchId: match.id,
            fromStatus: MatchStatus.PROPOSED,
            toStatus: MatchStatus.EXPIRED,
            actorUserId: "system-expiration",
          },
        });
      }
    });
  }
  return expired;
}

function formatWindowDate(date: Date | null): string | null {
  return date
    ? date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
}

export interface ProposedMatchParticipantView {
  id: string;
  organizationName: string;
  siteName: string;
  siteLocation: string | null;
  schedule: string | null;
  startDateLabel: string | null;
  endDateLabel: string | null;
  respondByLabel: string | null;
  /**
   * PENDING renders the Accept/Decline controls; ACCEPTED the waiting
   * state (Story 4.5). DECLINED never reaches this view — a decline moves
   * the match itself off PROPOSED.
   */
  participantDecision: "PENDING" | "ACCEPTED";
  /**
   * True while the coordinator is working a shelter change request
   * (Story 4.7 AC4): the card shows plain "being revised" language — the
   * shelter's internal note is never exposed — and no decision controls.
   */
  revising: boolean;
}

/**
 * The participant's own proposed placement (AC3): resource scope = self,
 * PROPOSED status or later only — never a Draft. Plain-language details;
 * no coordinator notes, no compatibility read, no restricted content
 * (structurally absent from the query).
 */
export async function getOwnProposedMatch(
  ctx: AuthContext,
): Promise<ProposedMatchParticipantView | null> {
  await expireStaleProposals();

  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;

  const match = await prisma.placementMatch.findFirst({
    where: {
      participantId: person.participant.id,
      // A Change Requested match is still the participant's live match —
      // it renders as "being revised" rather than vanishing (4.7 AC4).
      status: { in: [MatchStatus.PROPOSED, MatchStatus.CHANGE_REQUESTED] },
    },
    select: {
      id: true,
      status: true,
      participantDecision: true,
      proposedSchedule: true,
      proposedStartDate: true,
      proposedEndDate: true,
      decisionWindowEndsAt: true,
      organizationSite: {
        select: {
          name: true,
          city: true,
          region: true,
          organization: { select: { name: true } },
        },
      },
    },
  });
  if (!match) return null;

  const location = [match.organizationSite.city, match.organizationSite.region]
    .filter(Boolean)
    .join(", ");
  return {
    id: match.id,
    organizationName: match.organizationSite.organization.name,
    siteName: match.organizationSite.name,
    siteLocation: location || null,
    schedule: match.proposedSchedule,
    startDateLabel: formatWindowDate(match.proposedStartDate),
    endDateLabel: formatWindowDate(match.proposedEndDate),
    respondByLabel: formatWindowDate(match.decisionWindowEndsAt),
    participantDecision:
      match.participantDecision === ParticipantMatchDecision.ACCEPTED
        ? "ACCEPTED"
        : "PENDING",
    revising: match.status === MatchStatus.CHANGE_REQUESTED,
  };
}

export interface ShelterApprovalView {
  id: string;
  participantName: string;
  siteName: string;
  supervisorName: string | null;
  schedule: string | null;
  startDateLabel: string | null;
  endDateLabel: string | null;
  respondByLabel: string | null;
  statusLabel: string;
  shelterDecision: ShelterMatchDecision;
  shelterDecisionLabel: string;
  /**
   * True only for a Shelter Manager of THIS match's host organization
   * (Story 4.6 AC4): supervisors and other-org managers read, never
   * decide. Computed per row — a member may manage one organization and
   * supervise another.
   */
  viewerCanDecide: boolean;
}

const SHELTER_ROLES: readonly Role[] = [Role.SHELTER_MANAGER, Role.SHELTER_SUPERVISOR];

/**
 * The shelter's Placement approvals list (AC4): placementMatch.view,
 * resource scope = organization via hostOrganizationId, PROPOSED status or
 * later — Draft is never visible regardless of scope (AC6 covers other
 * organizations). Role-shaped: no coordinator notes, no compatibility
 * snapshot, no participant decision note.
 */
export async function listShelterApprovals(
  ctx: AuthContext,
): Promise<ShelterApprovalView[]> {
  await expireStaleProposals();

  if (!hasPermission(ctx, "placementMatch.view")) {
    throw new AuthorizationError();
  }
  const organizationIds = ctx.memberships
    .filter((membership) => SHELTER_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  if (organizationIds.length === 0) {
    throw new AuthorizationError();
  }
  const managerOrgIds = new Set(
    ctx.memberships
      .filter((membership) => membership.role === Role.SHELTER_MANAGER)
      .map((membership) => membership.organizationId),
  );

  const matches = await prisma.placementMatch.findMany({
    where: {
      hostOrganizationId: { in: organizationIds },
      status: MatchStatus.PROPOSED,
    },
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      organizationSite: { select: { name: true } },
    },
    orderBy: { proposedAt: "asc" },
  });

  const supervisorIds = [
    ...new Set(
      matches.map((m) => m.proposedSupervisorId).filter((id): id is string => !!id),
    ),
  ];
  const supervisors = await prisma.user.findMany({
    where: { id: { in: supervisorIds } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(supervisors.map((u) => [u.id, u.displayName]));

  return matches.map((match) => ({
    id: match.id,
    participantName: `${match.participant.person.legalFirstName} ${match.participant.person.legalLastName}`,
    siteName: match.organizationSite.name,
    supervisorName: match.proposedSupervisorId
      ? (nameById.get(match.proposedSupervisorId) ?? "Unknown user")
      : null,
    schedule: match.proposedSchedule,
    startDateLabel: formatWindowDate(match.proposedStartDate),
    endDateLabel: formatWindowDate(match.proposedEndDate),
    respondByLabel: formatWindowDate(match.decisionWindowEndsAt),
    statusLabel: MATCH_STATUS_LABELS[match.status],
    shelterDecision: match.shelterDecision,
    shelterDecisionLabel: SHELTER_DECISION_LABELS[match.shelterDecision],
    viewerCanDecide: managerOrgIds.has(match.hostOrganizationId),
  }));
}

// --- Participant decision (Story 4.5) --------------------------------------------

export type ParticipantDecisionChoice = "ACCEPTED" | "DECLINED";

/**
 * Record the participant's decision on a proposed match. Two authorized
 * paths to the SAME rules: the participant on their own match (ownership
 * through Person -> Participant, AC1/AC2/AC5), or a coordinator recording
 * a decision communicated by phone or in person (AC3) — the participant
 * remains the decision owner; recordedBy captures the recording actor.
 *
 * A decline is a unilateral veto: the match itself becomes Declined
 * regardless of the shelter track. An accept keeps the match Proposed —
 * it only satisfies one of the two prerequisites checked in 4.8. Both are
 * one-way for the current proposal cycle (AC4 gates via
 * decisionBlockReason), and the optional note is Operations-visible only
 * (AC6): never in shelter or participant view models, never in audit
 * detail.
 */
export async function recordParticipantDecision(
  ctx: AuthContext,
  matchId: string,
  input: { decision: ParticipantDecisionChoice; note?: string | null },
): Promise<void> {
  // Expire-on-access first: a proposal past its window with no decisions
  // expires rather than being decided late.
  await expireStaleProposals();

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      participantDecision: true,
      participant: { select: { person: { select: { userId: true } } } },
    },
  });
  if (!match) throw new NotFoundError();

  const isOwner = match.participant.person.userId === ctx.userId;
  const isAssistingStaff =
    hasPermission(ctx, "placementMatch.recordParticipantDecision") &&
    hasNovaScope(ctx);
  if (!isOwner && !isAssistingStaff) {
    throw new AuthorizationError();
  }

  const blocked = decisionBlockReason({
    status: match.status,
    decision: match.participantDecision,
  });
  if (blocked) throw new LifecycleError(blocked);

  const decision =
    input.decision === "DECLINED"
      ? ParticipantMatchDecision.DECLINED
      : ParticipantMatchDecision.ACCEPTED;
  const nextStatus = matchStatusAfterParticipantDecision(decision);
  const note = input.note?.trim() ? input.note.trim() : null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: {
        id: matchId,
        status: MatchStatus.PROPOSED,
        participantDecision: ParticipantMatchDecision.PENDING,
      },
      data: {
        status: nextStatus,
        participantDecision: decision,
        participantDecisionAt: new Date(),
        participantDecisionNote: note,
        participantDecisionRecordedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    // An accept keeps the match PROPOSED — from == to is honest there, and
    // the trail still records when and by whom the decision landed (4.7
    // relies on decision history never being silently overwritten).
    await tx.placementMatchEvent.create({
      data: {
        placementMatchId: matchId,
        fromStatus: MatchStatus.PROPOSED,
        toStatus: nextStatus,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.participantDecision",
        subjectType: "PlacementMatch",
        subjectId: matchId,
        // Non-sensitive summary only — the note itself never enters detail.
        detail: isOwner
          ? decision.toLowerCase()
          : `${decision.toLowerCase()} (recorded by staff on the participant's behalf)`,
      },
    });
  });
}

export interface DeclinedPlacementNotice {
  organizationName: string;
}

/**
 * A gentle, time-boxed dashboard notice after the participant's own
 * decline (Story 4.5 UX): visible for one decision-window's worth of days,
 * then the dashboard returns to the readiness journey — a decline is a
 * choice, not a flag that follows them around.
 */
export async function getOwnDeclinedPlacementNotice(
  ctx: AuthContext,
): Promise<DeclinedPlacementNotice | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;

  const cutoff = new Date(Date.now() - DECISION_WINDOW_DAYS * 86_400_000);
  const match = await prisma.placementMatch.findFirst({
    where: {
      participantId: person.participant.id,
      status: MatchStatus.DECLINED,
      participantDecision: ParticipantMatchDecision.DECLINED,
      participantDecisionAt: { gte: cutoff },
    },
    orderBy: { participantDecisionAt: "desc" },
    select: {
      organizationSite: { select: { organization: { select: { name: true } } } },
    },
  });
  return match
    ? { organizationName: match.organizationSite.organization.name }
    : null;
}

// --- Shelter decision (Story 4.6) ------------------------------------------------

export type ShelterDecisionChoice = "APPROVED" | "CHANGE_REQUESTED" | "DECLINED";

/**
 * Record the shelter's decision on a proposed match for THEIR organization
 * (AC1–AC3): Shelter Manager only (placementMatch.recordShelterDecision),
 * org-scoped through hostOrganizationId — a different shelter's manager is
 * denied (AC5), and supervisors hold view without decide (AC4). A decline
 * is a unilateral veto; a change request hands the match to the
 * coordinator (4.7); an approval keeps it Proposed for the 4.8 gate. The
 * note is REQUIRED for Change Requested and Declined so the coordinator
 * has something actionable — and it never enters audit detail.
 */
export async function recordShelterDecision(
  ctx: AuthContext,
  matchId: string,
  input: { decision: ShelterDecisionChoice; note?: string | null },
): Promise<void> {
  // Expire-on-access first: a proposal past its window with no decisions
  // expires rather than being decided late.
  await expireStaleProposals();

  const match = await prisma.placementMatch.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, shelterDecision: true, hostOrganizationId: true },
  });
  if (!match) throw new NotFoundError();

  const isHostManager = ctx.memberships.some(
    (membership) =>
      membership.role === Role.SHELTER_MANAGER &&
      membership.organizationId === match.hostOrganizationId,
  );
  if (!hasPermission(ctx, "placementMatch.recordShelterDecision") || !isHostManager) {
    throw new AuthorizationError();
  }

  const blocked = decisionBlockReason({
    status: match.status,
    decision: match.shelterDecision,
  });
  if (blocked) throw new LifecycleError(blocked);

  const decision = ShelterMatchDecision[input.decision];
  const note = input.note?.trim() ? input.note.trim() : null;
  if (shelterDecisionRequiresNote(decision) && !note) {
    throw new ValidationError(
      "Add a note for the coordinator — what needs to change, or why this doesn't work.",
    );
  }
  const nextStatus = matchStatusAfterShelterDecision(decision);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placementMatch.updateMany({
      where: {
        id: matchId,
        status: MatchStatus.PROPOSED,
        shelterDecision: ShelterMatchDecision.PENDING,
      },
      data: {
        status: nextStatus,
        shelterDecision: decision,
        shelterDecisionAt: new Date(),
        shelterDecisionNote: note,
        shelterDecisionRecordedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This match changed while you were working. Refresh and try again.",
      );
    }
    // An approval keeps the match PROPOSED — from == to records the
    // decision moment in the trail, mirroring the participant track.
    await tx.placementMatchEvent.create({
      data: {
        placementMatchId: matchId,
        fromStatus: MatchStatus.PROPOSED,
        toStatus: nextStatus,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placementMatch.shelterDecision",
        subjectType: "PlacementMatch",
        subjectId: matchId,
        // Non-sensitive summary only — the note itself never enters detail.
        detail: decision.toLowerCase().replaceAll("_", " "),
      },
    });
  });
}
