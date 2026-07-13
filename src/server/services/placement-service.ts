import {
  ActiveStatus,
  FundingAssignmentStatus,
  OnboardingTaskStatus,
  OrganizationKind,
  PlacementStatus,
  Prisma,
  Role,
  ScheduleDay,
  type EnrollmentStatus,
  type ParticipantMatchDecision,
  type ShelterMatchDecision,
} from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  ACTIVE_PLACEMENT_STATUSES,
  assertPlacementTransition,
  PLACEMENT_ONBOARDING_CATALOG,
  buildPlacementTimeline,
  packageMissingPieces,
  pauseEventDetail,
  pauseReasonLabel,
  PLACEMENT_STATUS_LABELS,
  resumeEventDetail,
  scheduleValidationError,
  TERMINAL_PLACEMENT_STATUSES,
  type ScheduleDayInput,
  type TimelineStage,
} from "@/server/domain/placement";
import {
  activationBlocksApply,
  openActivationBlockers,
  type ActivationPrerequisiteKey,
  type ActivationSnapshot,
} from "@/server/domain/placement-activation";
import { computeMatchingReadiness } from "@/server/domain/matching-readiness";
import { loadReadinessInputs } from "@/server/services/readiness-service";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

/**
 * Placement workspace reads (Story 5.1). One underlying Placement, three
 * role-shaped view models — Nova Operations (full), Shelter (no Case
 * Notes tab, no internal-only fields), Participant (plain-language "My
 * Placement") — composed here at the server boundary. Raw Prisma records
 * never reach the UI, and a tab absent from the view model has no
 * server-side content path at all. Later stories populate the tabs;
 * lifecycle transitions live in 5.2/5.6–5.8, never here.
 */

export type WorkspaceViewer = "NOVA" | "SHELTER";

export type WorkspaceTab =
  | "overview"
  | "schedule"
  | "hours"
  | "evaluations"
  | "incidents"
  | "caseNotes"
  | "documents"
  | "funding"
  | "history";

/** Tab order per docs/ux/wireframes-layouts.md. */
const NOVA_TABS: readonly WorkspaceTab[] = [
  "overview",
  "schedule",
  "hours",
  "evaluations",
  "incidents",
  "caseNotes",
  "documents",
  "funding",
  "history",
];

/** Shelter: Case Notes is structurally absent (AC2), not hidden. */
const SHELTER_TABS: readonly WorkspaceTab[] = [
  "overview",
  "schedule",
  "hours",
  "evaluations",
  "incidents",
  "documents",
  "funding",
  "history",
];

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: "Overview",
  schedule: "Schedule",
  hours: "Hours",
  evaluations: "Evaluations",
  incidents: "Incidents",
  caseNotes: "Case Notes",
  documents: "Documents",
  funding: "Funding",
  history: "History",
};

export interface PlacementHistoryEntry {
  id: string;
  atLabel: string;
  fromLabel: string | null;
  toLabel: string;
  actorName: string;
  /**
   * The event's ops-internal record — pause reasons (Story 5.7), archived
   * change-request notes (5.2). Populated for Nova viewers only; shelter
   * history carries the transitions without it.
   */
  detail: string | null;
}

const DAY_ORDER: ScheduleDay[] = [
  ScheduleDay.MONDAY,
  ScheduleDay.TUESDAY,
  ScheduleDay.WEDNESDAY,
  ScheduleDay.THURSDAY,
  ScheduleDay.FRIDAY,
  ScheduleDay.SATURDAY,
  ScheduleDay.SUNDAY,
];

export const SCHEDULE_DAY_LABELS: Record<ScheduleDay, string> = {
  [ScheduleDay.MONDAY]: "Monday",
  [ScheduleDay.TUESDAY]: "Tuesday",
  [ScheduleDay.WEDNESDAY]: "Wednesday",
  [ScheduleDay.THURSDAY]: "Thursday",
  [ScheduleDay.FRIDAY]: "Friday",
  [ScheduleDay.SATURDAY]: "Saturday",
  [ScheduleDay.SUNDAY]: "Sunday",
};

export interface ScheduleView {
  days: { day: ScheduleDay; dayLabel: string; startTime: string; endTime: string }[];
  /** Decimal-shaped string — floating point never touches it (RULES.md). */
  weeklyHoursTarget: string;
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface AssignmentOptions {
  siteOptions: SelectOption[];
  supervisorOptions: SelectOption[];
  coordinatorOptions: SelectOption[];
}

export interface PlacementWorkspaceView {
  viewer: WorkspaceViewer;
  id: string;
  placementNumber: string;
  status: PlacementStatus;
  statusLabel: string;
  isTerminal: boolean;
  participantName: string;
  organizationName: string;
  siteName: string;
  siteLocation: string | null;
  supervisorName: string | null;
  coordinatorName: string | null;
  scheduleSummary: string | null;
  startDateLabel: string | null;
  endDateLabel: string | null;
  /** The candidate funding reference carried from the match (5.3 assigns). */
  fundingSummary: string | null;
  tabs: WorkspaceTab[];
  timeline: TimelineStage[];
  history: PlacementHistoryEntry[];
  /** The structured working schedule once assigned (Story 5.2). */
  structuredSchedule: ScheduleView | null;
  /** The shelter's outstanding change-request note on the package (5.2). */
  shelterReviewNote: string | null;
  /** What the package still needs before proposing — Nova viewer, Draft only. */
  packageMissing: string[];
  /** Assignment form options — Nova viewer, Draft only; null otherwise. */
  assignmentOptions: AssignmentOptions | null;
  /** True for a Shelter Manager of this org while the package is in review. */
  viewerCanApprovePackage: boolean;
  siteId: string;
  supervisorId: string | null;
  coordinatorUserId: string | null;
  /** Funding tab data (Story 5.3): the active assignment plus history. */
  funding: FundingTabView;
  /** Placement onboarding (Story 5.4): tasks plus viewer capabilities. */
  onboarding: PlacementOnboardingView;
  /**
   * The activation checklist (Story 5.5) — Nova viewer, pre-Active
   * statuses only; null once the placement activates or for shelter
   * viewers (participant program internals stay Nova-side).
   */
  activation: ActivationView | null;
  /**
   * The Activate control renders (Story 5.6): Nova viewer holding
   * placement.activate on an Onboarding placement. Disabled-not-hidden
   * while blockers remain — the panel reads `activation.open`.
   */
  viewerCanActivate: boolean;
  /** Pause/Resume controls (Story 5.7): Nova lifecycle-transition roles. */
  viewerCanPause: boolean;
  viewerCanResume: boolean;
}

export interface ActivationBlockerView {
  key: ActivationPrerequisiteKey;
  /** The prerequisite name per docs/product/placement-lifecycle.md. */
  title: string;
  /** Plain-language resolving step. */
  action: string;
  /** Where the resolving tab or action lives; null when structural. */
  href: string | null;
}

export interface ActivationView {
  /** Unmet prerequisites in the documented order — empty means clear. */
  open: ActivationBlockerView[];
}

export interface PlacementTaskView {
  id: string;
  title: string;
  description: string;
  required: boolean;
  participantCompletable: boolean;
  status: OnboardingTaskStatus;
  completedAtLabel: string | null;
  completedByName: string | null;
}

export interface PlacementOnboardingView {
  tasks: PlacementTaskView[];
  requiredRemaining: number;
  /** Nova viewer + placement.assign + status APPROVED. */
  canInitiate: boolean;
  /** Nova staff may complete any task while APPROVED/ONBOARDING. */
  viewerCanCompleteAllTasks: boolean;
  /** Shelter staff complete shelter-verified tasks for their org only. */
  viewerCanCompleteShelterTasks: boolean;
}

export interface FundingAssignmentView {
  id: string;
  fundingSourceName: string;
  statusLabel: "Active" | "Ended";
  startDateLabel: string;
  endDateLabel: string | null;
  /** Decimal-shaped strings with unit labels applied in the UI. */
  hourlyRate: string | null;
  hoursCap: string | null;
}

export interface FundingTabView {
  active: FundingAssignmentView | null;
  history: FundingAssignmentView[];
  /** Nova viewer holding funding.assign — the write controls render. */
  viewerCanAssign: boolean;
  /** Active funding-source master records to choose from (Story 1.8). */
  sourceOptions: SelectOption[];
}

function formatDate(date: Date | null): string | null {
  return date
    ? date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

const SHELTER_ROLES: readonly Role[] = [Role.SHELTER_MANAGER, Role.SHELTER_SUPERVISOR];

/**
 * The ops/shelter workspace (AC1/AC2/AC5). Viewer resolution: Nova scope
 * with placement.view → full; a shelter membership at the placement's
 * host organization with placement.view → shelter-shaped; anything else
 * is denied with no placement data in the response.
 */
export async function getPlacementWorkspace(
  ctx: AuthContext,
  placementId: string,
): Promise<PlacementWorkspaceView> {
  if (!hasPermission(ctx, "placement.view")) {
    throw new AuthorizationError();
  }

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      programEnrollment: {
        select: { id: true, status: true, participantId: true, programId: true },
      },
      sourceMatch: {
        select: { id: true, participantDecision: true, shelterDecision: true },
      },
      organizationSite: {
        select: {
          name: true,
          city: true,
          region: true,
          organization: { select: { name: true } },
        },
      },
      fundingSource: { select: { name: true } },
      structuredSchedule: { include: { days: true } },
      fundingAssignments: {
        include: { fundingSource: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      onboardingTasks: { orderBy: { sortOrder: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!placement) throw new NotFoundError();

  let viewer: WorkspaceViewer;
  if (hasNovaScope(ctx)) {
    viewer = "NOVA";
  } else if (
    ctx.memberships.some(
      (membership) =>
        SHELTER_ROLES.includes(membership.role) &&
        membership.organizationId === placement.hostOrganizationId,
    )
  ) {
    viewer = "SHELTER";
  } else {
    // Cross-organization shelter users are denied — no placement data in
    // the response payload (AC5).
    throw new AuthorizationError();
  }

  // Resolve people references to display names — ids never render.
  const userIds = [
    placement.supervisorId,
    placement.coordinatorUserId,
    ...placement.events.map((event) => event.actorUserId),
    ...placement.onboardingTasks.map((task) => task.completedByUserId),
  ].filter((id): id is string => !!id);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((user) => [user.id, user.displayName]));

  const lastNonTerminal = [...placement.events]
    .reverse()
    .find(
      (event) =>
        event.fromStatus !== null &&
        !(TERMINAL_PLACEMENT_STATUSES as readonly PlacementStatus[]).includes(
          event.fromStatus,
        ),
    )?.fromStatus;

  const location = [placement.organizationSite.city, placement.organizationSite.region]
    .filter(Boolean)
    .join(", ");

  return {
    viewer,
    id: placement.id,
    placementNumber: placement.placementNumber,
    status: placement.status,
    statusLabel: PLACEMENT_STATUS_LABELS[placement.status],
    isTerminal: (TERMINAL_PLACEMENT_STATUSES as readonly PlacementStatus[]).includes(
      placement.status,
    ),
    participantName: `${placement.participant.person.legalFirstName} ${placement.participant.person.legalLastName}`,
    organizationName: placement.organizationSite.organization.name,
    siteName: placement.organizationSite.name,
    siteLocation: location || null,
    supervisorName: placement.supervisorId
      ? (nameById.get(placement.supervisorId) ?? "Unknown user")
      : null,
    coordinatorName: placement.coordinatorUserId
      ? (nameById.get(placement.coordinatorUserId) ?? "Unknown user")
      : null,
    scheduleSummary: placement.schedule,
    startDateLabel: formatDate(placement.startDate),
    endDateLabel: formatDate(placement.endDate),
    fundingSummary: (() => {
      const active = placement.fundingAssignments.find(
        (assignment) => assignment.status === FundingAssignmentStatus.ACTIVE,
      );
      if (active) return `${active.fundingSource.name} (active)`;
      return placement.fundingSource
        ? `Candidate: ${placement.fundingSource.name}`
        : null;
    })(),
    tabs: viewer === "NOVA" ? [...NOVA_TABS] : [...SHELTER_TABS],
    timeline: buildPlacementTimeline(
      placement.status,
      lastNonTerminal ?? undefined,
    ),
    history: placement.events.map((event) => ({
      id: event.id,
      atLabel: formatDateTime(event.createdAt),
      fromLabel: event.fromStatus ? PLACEMENT_STATUS_LABELS[event.fromStatus] : null,
      toLabel: PLACEMENT_STATUS_LABELS[event.toStatus],
      actorName: nameById.get(event.actorUserId) ?? "Nova system",
      detail: viewer === "NOVA" ? event.detail : null,
    })),
    structuredSchedule: placement.structuredSchedule
      ? {
          days: [...placement.structuredSchedule.days]
            .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
            .map((entry) => ({
              day: entry.day,
              dayLabel: SCHEDULE_DAY_LABELS[entry.day],
              startTime: entry.startTime,
              endTime: entry.endTime,
            })),
          weeklyHoursTarget: placement.structuredSchedule.weeklyHoursTarget.toString(),
        }
      : null,
    shelterReviewNote: placement.shelterReviewNote,
    packageMissing:
      viewer === "NOVA" && placement.status === PlacementStatus.DRAFT
        ? packageMissingPieces({
            supervisorId: placement.supervisorId,
            coordinatorUserId: placement.coordinatorUserId,
            hasStructuredSchedule: placement.structuredSchedule !== null,
          })
        : [],
    assignmentOptions:
      viewer === "NOVA" && placement.status === PlacementStatus.DRAFT
        ? await loadAssignmentOptions(placement.hostOrganizationId)
        : null,
    viewerCanApprovePackage:
      viewer === "SHELTER" &&
      placement.status === PlacementStatus.SHELTER_REVIEW &&
      ctx.memberships.some(
        (membership) =>
          membership.role === Role.SHELTER_MANAGER &&
          membership.organizationId === placement.hostOrganizationId,
      ),
    siteId: placement.organizationSiteId,
    supervisorId: placement.supervisorId,
    coordinatorUserId: placement.coordinatorUserId,
    funding: await buildFundingTab(ctx, viewer, placement.fundingAssignments),
    onboarding: {
      tasks: placement.onboardingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        required: task.required,
        participantCompletable: task.participantCompletable,
        status: task.status,
        completedAtLabel: task.completedAt ? formatDate(task.completedAt) : null,
        completedByName: task.completedByUserId
          ? (nameById.get(task.completedByUserId) ?? "Nova staff")
          : null,
      })),
      requiredRemaining: placement.onboardingTasks.filter(
        (task) => task.required && task.status !== OnboardingTaskStatus.COMPLETE,
      ).length,
      canInitiate:
        viewer === "NOVA" &&
        hasPermission(ctx, "placement.assign") &&
        placement.status === PlacementStatus.APPROVED,
      viewerCanCompleteAllTasks:
        viewer === "NOVA" &&
        hasPermission(ctx, "onboardingTask.complete") &&
        (placement.status === PlacementStatus.APPROVED ||
          placement.status === PlacementStatus.ONBOARDING),
      viewerCanCompleteShelterTasks:
        viewer === "SHELTER" &&
        hasPermission(ctx, "onboardingTask.complete") &&
        (placement.status === PlacementStatus.APPROVED ||
          placement.status === PlacementStatus.ONBOARDING),
    },
    activation:
      viewer === "NOVA" && activationBlocksApply(placement.status)
        ? await buildActivationView(prisma, placement)
        : null,
    viewerCanActivate:
      viewer === "NOVA" &&
      hasPermission(ctx, "placement.activate") &&
      placement.status === PlacementStatus.ONBOARDING,
    viewerCanPause:
      viewer === "NOVA" &&
      hasPermission(ctx, "placement.pause") &&
      placement.status === PlacementStatus.ACTIVE,
    viewerCanResume:
      viewer === "NOVA" &&
      hasPermission(ctx, "placement.resume") &&
      placement.status === PlacementStatus.PAUSED,
  };
}

/** The rows the activation snapshot is computed from. */
interface ActivationSource {
  id: string;
  status: PlacementStatus;
  participantId: string;
  hostOrganizationId: string;
  organizationSiteId: string;
  supervisorId: string | null;
  coordinatorUserId: string | null;
  programEnrollment: {
    id: string;
    status: EnrollmentStatus;
    participantId: string;
    programId: string;
  };
  sourceMatch: {
    id: string;
    participantDecision: ParticipantMatchDecision;
    shelterDecision: ShelterMatchDecision;
  };
  structuredSchedule: { id: string } | null;
  onboardingTasks: { required: boolean; status: OnboardingTaskStatus }[];
  fundingAssignments: { status: FundingAssignmentStatus }[];
}

/**
 * Aggregate the live activation snapshot (Story 5.5): the 3.6 readiness
 * sources through their shared loader, this placement's own package and
 * task state, and the conflicting-placement probe. Computed on every
 * evaluation — never cached — so the list reflects server truth on each
 * load (AC3), and 5.6 re-runs the same aggregation inside its activation
 * transaction.
 */
async function loadActivationSnapshot(
  db: Prisma.TransactionClient,
  placement: ActivationSource,
): Promise<ActivationSnapshot> {
  const [readiness, conflict] = await Promise.all([
    loadReadinessInputs(db, placement.programEnrollment).then(computeMatchingReadiness),
    db.placement.findFirst({
      where: {
        participantId: placement.participantId,
        id: { not: placement.id },
        status: { in: [...ACTIVE_PLACEMENT_STATUSES] },
      },
      select: { placementNumber: true },
    }),
  ]);
  const outstanding = (kind: "task" | "training" | "certification") =>
    readiness.blockers.filter((blocker) => blocker.kind === kind).length;

  return {
    status: placement.status,
    enrollmentStatus: placement.programEnrollment.status,
    participantDecision: placement.sourceMatch.participantDecision,
    shelterDecision: placement.sourceMatch.shelterDecision,
    hostOrganizationAssigned: Boolean(placement.hostOrganizationId),
    siteAssigned: Boolean(placement.organizationSiteId),
    supervisorAssigned: placement.supervisorId !== null,
    coordinatorAssigned: placement.coordinatorUserId !== null,
    enrollmentTasksOutstanding: outstanding("task"),
    trainingOutstanding: outstanding("training"),
    certificationsOutstanding: outstanding("certification"),
    siteTasksGenerated: placement.onboardingTasks.length > 0,
    siteTasksOutstanding: placement.onboardingTasks.filter(
      (task) => task.required && task.status !== OnboardingTaskStatus.COMPLETE,
    ).length,
    scheduleAssigned: placement.structuredSchedule !== null,
    fundingActive: placement.fundingAssignments.some(
      (assignment) => assignment.status === FundingAssignmentStatus.ACTIVE,
    ),
    conflictingPlacementNumber: conflict?.placementNumber ?? null,
  };
}

/**
 * Where each blocker's resolving tab or action lives (AC on linking).
 * Operations paths only — the checklist is Nova-shaped.
 */
function activationHref(
  key: ActivationPrerequisiteKey,
  ids: { placementId: string; enrollmentId: string; matchId: string },
): string | null {
  const workspace = `/operations/placements/records/${ids.placementId}`;
  switch (key) {
    case "validEnrollment":
      return `/operations/enrollments/${ids.enrollmentId}`;
    case "participantAccepted":
    case "shelterApproved":
      return `/operations/placements/matches/${ids.matchId}`;
    case "hostAndSite":
    case "supervisorAndCoordinator":
    case "schedule":
      return `${workspace}?tab=schedule`;
    case "enrollmentOnboarding":
      return `/operations/enrollments/${ids.enrollmentId}#onboarding-tasks`;
    case "portableTraining":
      return `/operations/enrollments/${ids.enrollmentId}#training`;
    case "siteOnboarding":
      return `${workspace}#placement-onboarding`;
    case "funding":
      return `${workspace}?tab=funding`;
    case "noConflict":
      return "/operations/placements";
  }
}

async function buildActivationView(
  db: Prisma.TransactionClient,
  placement: ActivationSource,
): Promise<ActivationView> {
  const snapshot = await loadActivationSnapshot(db, placement);
  return {
    open: openActivationBlockers(snapshot).map((item) => ({
      key: item.key,
      title: item.title,
      action: item.action,
      href: activationHref(item.key, {
        placementId: placement.id,
        enrollmentId: placement.programEnrollment.id,
        matchId: placement.sourceMatch.id,
      }),
    })),
  };
}

export interface UrgentBlockerRow {
  placementId: string;
  placementNumber: string;
  participantName: string;
  siteName: string;
  /** Open prerequisite titles, in the documented order. */
  openTitles: string[];
}

/**
 * The Operations dashboard's "Urgent blockers" surface (Story 5.5;
 * docs/ux/wireframes-layouts.md): placements at the activation gate —
 * Onboarding, the last pre-Active stage — that still have open
 * prerequisites. Earlier-stage placements have expected open items and
 * are worked from their own workspaces, not flagged as urgent.
 */
export async function listUrgentBlockers(ctx: AuthContext): Promise<UrgentBlockerRow[]> {
  if (!hasPermission(ctx, "placement.view") || !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  const placements = await prisma.placement.findMany({
    where: { status: PlacementStatus.ONBOARDING },
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      programEnrollment: {
        select: { id: true, status: true, participantId: true, programId: true },
      },
      sourceMatch: {
        select: { id: true, participantDecision: true, shelterDecision: true },
      },
      organizationSite: { select: { name: true } },
      structuredSchedule: { select: { id: true } },
      fundingAssignments: { select: { status: true } },
      onboardingTasks: { select: { required: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: UrgentBlockerRow[] = [];
  for (const placement of placements) {
    const snapshot = await loadActivationSnapshot(prisma, placement);
    const open = openActivationBlockers(snapshot);
    if (open.length === 0) continue;
    rows.push({
      placementId: placement.id,
      placementNumber: placement.placementNumber,
      participantName: `${placement.participant.person.legalFirstName} ${placement.participant.person.legalLastName}`,
      siteName: placement.organizationSite.name,
      openTitles: open.map((item) => item.title),
    });
  }
  return rows;
}

// --- Activate placement (Story 5.6) ------------------------------------------------

/**
 * Onboarding -> Active behind the full prerequisite gate (AC1/AC2). The
 * 5.5 evaluation re-runs INSIDE the transaction against live rows — a
 * client that believes it is clear cannot slip a stale "blockers empty"
 * past the server, and a direct or replayed request hits the same wall.
 * The compare-and-set makes concurrent activations a conflict, never a
 * duplicate event (AC3); the one-active-placement partial unique index
 * remains the database backstop beneath it all (AC4). Activation stamps
 * the placement's startDate — the participant's effective start — over
 * any candidate date carried from the match.
 */
export async function activatePlacement(
  ctx: AuthContext,
  placementId: string,
): Promise<void> {
  if (!hasPermission(ctx, "placement.activate")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const existing = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError();
  assertPlacementTransition(existing.status, PlacementStatus.ACTIVE);

  // The effective start date — today, as a UTC calendar date.
  const activatedOn = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    const placement = await tx.placement.findUnique({
      where: { id: placementId },
      include: {
        programEnrollment: {
          select: { id: true, status: true, participantId: true, programId: true },
        },
        sourceMatch: {
          select: { id: true, participantDecision: true, shelterDecision: true },
        },
        structuredSchedule: { select: { id: true } },
        fundingAssignments: { select: { status: true } },
        onboardingTasks: { select: { required: true, status: true } },
      },
    });
    if (!placement) throw new NotFoundError();

    const open = openActivationBlockers(await loadActivationSnapshot(tx, placement));
    if (open.length > 0) {
      throw new LifecycleError(
        `Activation is blocked. Outstanding: ${open.map((item) => item.title).join("; ")}.`,
      );
    }

    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.ONBOARDING },
      data: { status: PlacementStatus.ACTIVE, startDate: activatedOn },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.ONBOARDING,
        toStatus: PlacementStatus.ACTIVE,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.activate",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

// --- Pause and resume (Story 5.7) ---------------------------------------------------

function requireLifecycleTransition(
  ctx: AuthContext,
  permission: "placement.pause" | "placement.resume",
): void {
  if (!hasPermission(ctx, permission)) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

export interface PausePlacementInput {
  reasonKey: string;
  note: string | null;
  effectiveDate: Date;
}

/**
 * Active -> Paused with a required reason and effective date (AC1). The
 * reason (category + optional note) and effective date ride the
 * lifecycle event's ops-internal detail — medical and personal
 * circumstances never reach shelter viewers, while the Paused status
 * itself is visible everywhere the placement appears (AC5). Audit detail
 * stays non-sensitive. Cycles accumulate as append-only events, never
 * overwritten (AC3).
 */
export async function pausePlacement(
  ctx: AuthContext,
  placementId: string,
  input: PausePlacementInput,
): Promise<void> {
  requireLifecycleTransition(ctx, "placement.pause");

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true },
  });
  if (!placement) throw new NotFoundError();
  assertPlacementTransition(placement.status, PlacementStatus.PAUSED);

  const reasonLabel = pauseReasonLabel(input.reasonKey);
  if (!reasonLabel) {
    throw new ValidationError("Choose the reason for this pause.");
  }
  if (Number.isNaN(input.effectiveDate.getTime())) {
    throw new ValidationError("Provide the date the pause takes effect.");
  }

  const detail = pauseEventDetail({
    reasonLabel,
    effectiveDateLabel: formatDate(input.effectiveDate) ?? "",
    note: input.note?.trim() ? input.note.trim() : null,
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.ACTIVE },
      data: { status: PlacementStatus.PAUSED },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.ACTIVE,
        toStatus: PlacementStatus.PAUSED,
        actorUserId: ctx.userId,
        detail,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.pause",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

/**
 * Paused -> Active with a resume date (AC2) — the loop's other half,
 * evented and audited the same way. A placement may pause and resume any
 * number of times; History shows every cycle in order.
 */
export async function resumePlacement(
  ctx: AuthContext,
  placementId: string,
  resumeDate: Date,
): Promise<void> {
  requireLifecycleTransition(ctx, "placement.resume");

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true },
  });
  if (!placement) throw new NotFoundError();
  // ONBOARDING -> ACTIVE is also a legal table transition (activation),
  // so resume checks its source state explicitly: paused placements only.
  if (placement.status !== PlacementStatus.PAUSED) {
    throw new LifecycleError("Only a paused placement can resume.");
  }
  assertPlacementTransition(placement.status, PlacementStatus.ACTIVE);

  if (Number.isNaN(resumeDate.getTime())) {
    throw new ValidationError("Provide the date work resumes.");
  }
  const detail = resumeEventDetail({
    effectiveDateLabel: formatDate(resumeDate) ?? "",
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.PAUSED },
      data: { status: PlacementStatus.ACTIVE },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.PAUSED,
        toStatus: PlacementStatus.ACTIVE,
        actorUserId: ctx.userId,
        detail,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.resume",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

function toFundingAssignmentView(assignment: {
  id: string;
  status: FundingAssignmentStatus;
  startDate: Date;
  endDate: Date | null;
  hourlyRate: Prisma.Decimal | null;
  hoursCap: Prisma.Decimal | null;
  fundingSource: { name: string };
}): FundingAssignmentView {
  return {
    id: assignment.id,
    fundingSourceName: assignment.fundingSource.name,
    statusLabel: assignment.status === FundingAssignmentStatus.ACTIVE ? "Active" : "Ended",
    startDateLabel: formatDate(assignment.startDate) ?? "",
    endDateLabel: formatDate(assignment.endDate),
    hourlyRate: assignment.hourlyRate?.toString() ?? null,
    hoursCap: assignment.hoursCap?.toString() ?? null,
  };
}

async function buildFundingTab(
  ctx: AuthContext,
  viewer: WorkspaceViewer,
  assignments: Parameters<typeof toFundingAssignmentView>[0][],
): Promise<FundingTabView> {
  const viewerCanAssign =
    viewer === "NOVA" && hasPermission(ctx, "funding.assign") && hasNovaScope(ctx);
  const sourceOptions = viewerCanAssign
    ? (
        await prisma.fundingSource.findMany({
          where: { status: ActiveStatus.ACTIVE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      ).map((source) => ({ id: source.id, label: source.name }))
    : [];
  return {
    active:
      assignments
        .filter((assignment) => assignment.status === FundingAssignmentStatus.ACTIVE)
        .map(toFundingAssignmentView)[0] ?? null,
    history: assignments.map(toFundingAssignmentView),
    viewerCanAssign,
    sourceOptions,
  };
}

/** Form options scoped to the placement's host organization (AC1/AC2). */
async function loadAssignmentOptions(
  hostOrganizationId: string,
): Promise<AssignmentOptions> {
  const [sites, supervisors, coordinators] = await Promise.all([
    prisma.organizationSite.findMany({
      where: { organizationId: hostOrganizationId, status: ActiveStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: hostOrganizationId,
        role: { in: [Role.SHELTER_SUPERVISOR, Role.SHELTER_MANAGER] },
        status: ActiveStatus.ACTIVE,
      },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { user: { displayName: "asc" } },
    }),
    prisma.membership.findMany({
      where: {
        role: { in: [Role.PROGRAM_COORDINATOR, Role.NOVA_ADMINISTRATOR] },
        status: ActiveStatus.ACTIVE,
        organization: { kind: OrganizationKind.NOVA },
      },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { user: { displayName: "asc" } },
    }),
  ]);

  const dedupe = (rows: { user: { id: string; displayName: string } }[]) => {
    const seen = new Map<string, string>();
    for (const row of rows) seen.set(row.user.id, row.user.displayName);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  };

  return {
    siteOptions: sites.map((site) => ({ id: site.id, label: site.name })),
    supervisorOptions: dedupe(supervisors),
    coordinatorOptions: dedupe(coordinators),
  };
}

export interface PlacementRecordRow {
  id: string;
  placementNumber: string;
  participantName: string;
  organizationName: string;
  siteName: string;
  statusLabel: string;
}

/** The Operations placement-records list — the workspace entry point. */
export async function listPlacementRecords(
  ctx: AuthContext,
): Promise<PlacementRecordRow[]> {
  if (!hasPermission(ctx, "placement.view") || !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  return listPlacementRows({});
}

/** The shelter's own placements (organization scope via hostOrganizationId). */
export async function listShelterPlacements(
  ctx: AuthContext,
): Promise<PlacementRecordRow[]> {
  if (!hasPermission(ctx, "placement.view")) {
    throw new AuthorizationError();
  }
  const organizationIds = ctx.memberships
    .filter((membership) => SHELTER_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  if (organizationIds.length === 0) {
    throw new AuthorizationError();
  }
  return listPlacementRows({ hostOrganizationId: { in: organizationIds } });
}

async function listPlacementRows(where: {
  hostOrganizationId?: { in: string[] };
}): Promise<PlacementRecordRow[]> {
  const placements = await prisma.placement.findMany({
    where,
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      organizationSite: {
        select: { name: true, organization: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return placements.map((placement) => ({
    id: placement.id,
    placementNumber: placement.placementNumber,
    participantName: `${placement.participant.person.legalFirstName} ${placement.participant.person.legalLastName}`,
    organizationName: placement.organizationSite.organization.name,
    siteName: placement.organizationSite.name,
    statusLabel: PLACEMENT_STATUS_LABELS[placement.status],
  }));
}

/**
 * Plain-language stage descriptions for the participant's own view (AC3)
 * — internal lifecycle names translated per the content style guide, and
 * never a raw internal blocker code.
 */
const PARTICIPANT_STAGE_COPY: Record<PlacementStatus, { label: string; body: string }> = {
  [PlacementStatus.DRAFT]: {
    label: "Being prepared",
    body: "Your coordinator is setting up the details of this placement.",
  },
  [PlacementStatus.PROPOSED]: {
    label: "Being prepared",
    body: "Your coordinator is setting up the details of this placement.",
  },
  [PlacementStatus.SHELTER_REVIEW]: {
    label: "With the shelter for review",
    body: "The shelter is reviewing the site, supervisor, and schedule plan.",
  },
  [PlacementStatus.APPROVED]: {
    label: "Approved — getting ready",
    body: "The plan is approved. A few preparation steps come next before your first day.",
  },
  [PlacementStatus.ONBOARDING]: {
    label: "Getting ready to start",
    body: "You're in the preparation phase — complete your remaining steps and we'll confirm your start.",
  },
  [PlacementStatus.ACTIVE]: {
    label: "Active",
    body: "Your placement is underway. Your schedule and supervisor are below.",
  },
  [PlacementStatus.PAUSED]: {
    label: "Paused for now",
    body: "Your placement is paused. Your coordinator will work with you on next steps whenever you're ready.",
  },
  [PlacementStatus.COMPLETED]: {
    label: "Completed",
    body: "You completed this placement — congratulations on the work you put in.",
  },
  [PlacementStatus.CONVERTED_TO_PERMANENT]: {
    label: "Hired permanently",
    body: "This placement became a permanent job — a wonderful milestone.",
  },
  [PlacementStatus.WITHDRAWN]: {
    label: "Ended",
    body: "This placement ended. You're still part of the program, and your coordinator is glad to talk about what's next.",
  },
  [PlacementStatus.TERMINATED]: {
    label: "Ended",
    body: "This placement ended. You're still part of the program, and your coordinator is glad to talk about what's next.",
  },
};

export interface ParticipantStepView {
  id: string;
  title: string;
  description: string;
  status: OnboardingTaskStatus;
}

export interface ParticipantPlacementView {
  placementNumber: string;
  organizationName: string;
  siteName: string;
  siteLocation: string | null;
  stageLabel: string;
  stageBody: string;
  scheduleSummary: string | null;
  startDateLabel: string | null;
  supervisorName: string | null;
  /** The participant's own placement-onboarding steps (Story 5.4). */
  mySteps: ParticipantStepView[];
}

/**
 * The participant's own "My Placement" view (AC3): ownership-scoped, the
 * most recent placement, plain language — no case notes, no internal
 * blocker codes, no other participants' data (structurally impossible:
 * only their own record is queried).
 */
export async function getOwnPlacement(
  ctx: AuthContext,
): Promise<ParticipantPlacementView | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;

  const placement = await prisma.placement.findFirst({
    where: { participantId: person.participant.id },
    orderBy: { createdAt: "desc" },
    include: {
      organizationSite: {
        select: {
          name: true,
          city: true,
          region: true,
          organization: { select: { name: true } },
        },
      },
      onboardingTasks: {
        where: { participantCompletable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!placement) return null;

  const supervisor = placement.supervisorId
    ? await prisma.user.findUnique({
        where: { id: placement.supervisorId },
        select: { displayName: true },
      })
    : null;

  const copy = PARTICIPANT_STAGE_COPY[placement.status];
  const location = [placement.organizationSite.city, placement.organizationSite.region]
    .filter(Boolean)
    .join(", ");
  return {
    placementNumber: placement.placementNumber,
    organizationName: placement.organizationSite.organization.name,
    siteName: placement.organizationSite.name,
    siteLocation: location || null,
    stageLabel: copy.label,
    stageBody: copy.body,
    scheduleSummary: placement.schedule,
    startDateLabel: formatDate(placement.startDate),
    supervisorName: supervisor?.displayName ?? null,
    mySteps:
      placement.status === PlacementStatus.APPROVED ||
      placement.status === PlacementStatus.ONBOARDING
        ? placement.onboardingTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
          }))
        : [],
  };
}

// --- Assign site, supervisor, and schedule (Story 5.2) ----------------------------

function requireAssignAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "placement.assign")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

export interface SaveAssignmentInput {
  siteId: string;
  supervisorId: string | null;
  coordinatorUserId: string | null;
  days: ScheduleDayInput[];
  weeklyHoursTarget: string | null;
}

/**
 * Save the review package while the placement is Draft (AC1/AC2):
 * site must belong to the placement's host organization; the supervisor
 * must hold an ACTIVE Shelter Supervisor or Shelter Manager membership
 * there; the coordinator of record must be ACTIVE Nova Operations staff.
 * Partial progress saves — the propose gate names whatever is missing.
 * Weekly hours stay decimal-shaped end to end (RULES.md).
 */
export async function saveAssignment(
  ctx: AuthContext,
  placementId: string,
  input: SaveAssignmentInput,
): Promise<void> {
  requireAssignAccess(ctx);

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, hostOrganizationId: true },
  });
  if (!placement) throw new NotFoundError();
  if (placement.status !== PlacementStatus.DRAFT) {
    throw new LifecycleError(
      "The review package can only be edited while the placement is a draft.",
    );
  }

  const site = await prisma.organizationSite.findUnique({
    where: { id: input.siteId },
    select: { id: true, organizationId: true, status: true },
  });
  if (
    !site ||
    site.organizationId !== placement.hostOrganizationId ||
    site.status !== ActiveStatus.ACTIVE
  ) {
    throw new ValidationError(
      "Choose an active site belonging to this placement's host organization.",
    );
  }

  if (input.supervisorId) {
    const eligible = await prisma.membership.count({
      where: {
        userId: input.supervisorId,
        organizationId: placement.hostOrganizationId,
        role: { in: [Role.SHELTER_SUPERVISOR, Role.SHELTER_MANAGER] },
        status: ActiveStatus.ACTIVE,
      },
    });
    if (eligible === 0) {
      throw new ValidationError(
        "The supervisor must hold an active Shelter Supervisor or Shelter Manager membership at this organization.",
      );
    }
  }

  if (input.coordinatorUserId) {
    const eligible = await prisma.membership.count({
      where: {
        userId: input.coordinatorUserId,
        role: { in: [Role.PROGRAM_COORDINATOR, Role.NOVA_ADMINISTRATOR] },
        status: ActiveStatus.ACTIVE,
        organization: { kind: OrganizationKind.NOVA },
      },
    });
    if (eligible === 0) {
      throw new ValidationError(
        "The coordinator of record must be active Nova Operations staff.",
      );
    }
  }

  const hasSchedule = input.days.length > 0 || (input.weeklyHoursTarget ?? "") !== "";
  if (hasSchedule) {
    const problem = scheduleValidationError({
      days: input.days,
      weeklyHoursTarget: input.weeklyHoursTarget ?? "",
    });
    if (problem) throw new ValidationError(problem);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.DRAFT },
      data: {
        organizationSiteId: site.id,
        supervisorId: input.supervisorId,
        coordinatorUserId: input.coordinatorUserId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }

    const existing = await tx.placementSchedule.findUnique({
      where: { placementId },
      select: { id: true },
    });
    if (existing) {
      await tx.placementScheduleDay.deleteMany({ where: { scheduleId: existing.id } });
      await tx.placementSchedule.delete({ where: { id: existing.id } });
    }
    if (hasSchedule) {
      await tx.placementSchedule.create({
        data: {
          placementId,
          weeklyHoursTarget: new Prisma.Decimal(input.weeklyHoursTarget ?? "0"),
          days: {
            create: input.days.map((entry) => ({
              day: entry.day as ScheduleDay,
              startTime: entry.startTime,
              endTime: entry.endTime,
            })),
          },
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.assign",
        subjectType: "Placement",
        subjectId: placementId,
        detail: "package-edited",
      },
    });
  });
}

/**
 * Propose the completed package to the shelter (AC3): Draft -> Proposed
 * -> Shelter Review in one action — both documented transitions get
 * their lifecycle events. Missing pieces are NAMED; the one-Onboarding/
 * Active/Paused-placement rule is cited when a conflict blocks (AC5).
 */
export async function proposePlacementPackage(
  ctx: AuthContext,
  placementId: string,
): Promise<void> {
  requireAssignAccess(ctx);

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    include: { structuredSchedule: { select: { id: true } } },
  });
  if (!placement) throw new NotFoundError();
  assertPlacementTransition(placement.status, PlacementStatus.PROPOSED);

  const missing = packageMissingPieces({
    supervisorId: placement.supervisorId,
    coordinatorUserId: placement.coordinatorUserId,
    hasStructuredSchedule: placement.structuredSchedule !== null,
  });
  if (missing.length > 0) {
    throw new ValidationError(
      `Complete these before proposing: ${missing.join("; ")}.`,
    );
  }

  const conflicting = await prisma.placement.count({
    where: {
      participantId: placement.participantId,
      id: { not: placementId },
      status: { in: [...ACTIVE_PLACEMENT_STATUSES] },
    },
  });
  if (conflicting > 0) {
    throw new ConflictError(
      "This participant already holds an onboarding, active, or paused placement — one placement at a time.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.DRAFT },
      data: { status: PlacementStatus.SHELTER_REVIEW, shelterReviewNote: null },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    // The package walks Draft -> Proposed -> Shelter Review; Proposed is
    // momentary but documented, so both transitions are evented.
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.DRAFT,
        toStatus: PlacementStatus.PROPOSED,
        actorUserId: ctx.userId,
      },
    });
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.PROPOSED,
        toStatus: PlacementStatus.SHELTER_REVIEW,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.propose",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

function requirePackageReviewAccess(
  ctx: AuthContext,
  hostOrganizationId: string,
): void {
  const isHostManager = ctx.memberships.some(
    (membership) =>
      membership.role === Role.SHELTER_MANAGER &&
      membership.organizationId === hostOrganizationId,
  );
  if (!hasPermission(ctx, "placement.approve") || !isHostManager) {
    throw new AuthorizationError();
  }
}

/**
 * The Shelter Manager approves the site/supervisor/schedule package
 * (AC4): Shelter Review -> Approved with its lifecycle event — ADR-013's
 * placement-level gate, distinct from the Epic 4 match decision.
 */
export async function approvePlacementPackage(
  ctx: AuthContext,
  placementId: string,
): Promise<void> {
  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, hostOrganizationId: true },
  });
  if (!placement) throw new NotFoundError();
  requirePackageReviewAccess(ctx, placement.hostOrganizationId);
  assertPlacementTransition(placement.status, PlacementStatus.APPROVED);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.SHELTER_REVIEW },
      data: { status: PlacementStatus.APPROVED },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.SHELTER_REVIEW,
        toStatus: PlacementStatus.APPROVED,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.approvePackage",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

/**
 * The Shelter Manager returns the package for revision instead of a dead
 * end: Shelter Review -> Draft with a REQUIRED, actionable note — set as
 * the outstanding note on the row and archived on the lifecycle event
 * (never in audit detail), mirroring the match change-request pattern.
 */
export async function requestPlacementChanges(
  ctx: AuthContext,
  placementId: string,
  note: string | null,
): Promise<void> {
  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, hostOrganizationId: true },
  });
  if (!placement) throw new NotFoundError();
  requirePackageReviewAccess(ctx, placement.hostOrganizationId);
  assertPlacementTransition(placement.status, PlacementStatus.DRAFT);

  const trimmed = note?.trim() ? note.trim() : null;
  if (!trimmed) {
    throw new ValidationError(
      "Add a note for the coordinator — what needs to change about the site, supervisor, or schedule.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.SHELTER_REVIEW },
      data: { status: PlacementStatus.DRAFT, shelterReviewNote: trimmed },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.SHELTER_REVIEW,
        toStatus: PlacementStatus.DRAFT,
        actorUserId: ctx.userId,
        detail: `Changes requested: "${trimmed}"`,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.requestChanges",
        subjectType: "Placement",
        subjectId: placementId,
        detail: "changes requested",
      },
    });
  });
}

// --- Placement onboarding (Story 5.4; ADR-017 Layer 2) ----------------------------

/**
 * Initiate placement onboarding (AC1): generates the site-specific task
 * set linked to THIS placement (never the enrollment — XOR ownership) and
 * enters Onboarding, in one transaction. Idempotent on tasks: a retry
 * never duplicates the catalog.
 */
export async function initiatePlacementOnboarding(
  ctx: AuthContext,
  placementId: string,
): Promise<void> {
  requireAssignAccess(ctx);

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true },
  });
  if (!placement) throw new NotFoundError();
  assertPlacementTransition(placement.status, PlacementStatus.ONBOARDING);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: PlacementStatus.APPROVED },
      data: { status: PlacementStatus.ONBOARDING },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Refresh and try again.",
      );
    }
    const existing = await tx.onboardingTask.count({ where: { placementId } });
    if (existing === 0) {
      await tx.onboardingTask.createMany({
        data: PLACEMENT_ONBOARDING_CATALOG.map((item) => ({
          placementId,
          title: item.title,
          description: item.description,
          required: item.required,
          participantCompletable: item.participantCompletable,
          sortOrder: item.sortOrder,
        })),
      });
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: PlacementStatus.APPROVED,
        toStatus: PlacementStatus.ONBOARDING,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "placement.initiateOnboarding",
        subjectType: "Placement",
        subjectId: placementId,
        detail:
          existing === 0
            ? `${PLACEMENT_ONBOARDING_CATALOG.length} tasks generated`
            : "onboarding entered (tasks already present)",
      },
    });
  });
}

const TASK_ACTIONABLE_STATUSES: readonly PlacementStatus[] = [
  PlacementStatus.APPROVED,
  PlacementStatus.ONBOARDING,
];

/**
 * Staff verification of a placement task (AC4): Nova staff may complete
 * any task; shelter staff (Supervisor or Manager, org-scoped) complete
 * shelter-verified tasks only — never the participant's own
 * acknowledgements. Actionable only while Approved/Onboarding,
 * server-enforced.
 */
export async function completePlacementTask(
  ctx: AuthContext,
  taskId: string,
): Promise<void> {
  if (!hasPermission(ctx, "onboardingTask.complete")) {
    throw new AuthorizationError();
  }

  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: {
      placement: { select: { id: true, status: true, hostOrganizationId: true } },
    },
  });
  if (!task || !task.placementId || !task.placement) throw new NotFoundError();

  const isNova = hasNovaScope(ctx);
  const isShelterStaff = ctx.memberships.some(
    (membership) =>
      SHELTER_ROLES.includes(membership.role) &&
      membership.organizationId === task.placement!.hostOrganizationId,
  );
  if (!isNova && !isShelterStaff) {
    throw new AuthorizationError();
  }
  if (!isNova && task.participantCompletable) {
    // Shelter staff verify shelter-facing steps; the participant's own
    // acknowledgements belong to the participant (or the coordinator).
    throw new AuthorizationError();
  }
  if (!TASK_ACTIONABLE_STATUSES.includes(task.placement.status)) {
    throw new LifecycleError(
      "Placement onboarding tasks are actionable only while the placement is approved or onboarding.",
    );
  }
  if (task.status === OnboardingTaskStatus.COMPLETE) {
    throw new LifecycleError("This task is already complete.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.onboardingTask.updateMany({
      where: { id: taskId, status: OnboardingTaskStatus.NOT_STARTED },
      data: {
        status: OnboardingTaskStatus.COMPLETE,
        completedAt: new Date(),
        completedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This task changed while you were working. Refresh and try again.",
      );
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "onboardingTask.complete",
        subjectType: "OnboardingTask",
        subjectId: taskId,
        detail: "placement-task",
      },
    });
  });
}

/**
 * The participant completes their own placement task (AC3): ownership
 * through Placement -> Participant -> Person, participant-completable
 * tasks only, same lifecycle window.
 */
export async function completeOwnPlacementTask(
  ctx: AuthContext,
  taskId: string,
): Promise<void> {
  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: {
      placement: {
        select: {
          id: true,
          status: true,
          participant: { select: { person: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!task || !task.placementId || !task.placement) throw new NotFoundError();
  if (task.placement.participant.person.userId !== ctx.userId) {
    throw new AuthorizationError();
  }
  if (!task.participantCompletable) {
    throw new AuthorizationError();
  }
  if (!TASK_ACTIONABLE_STATUSES.includes(task.placement.status)) {
    throw new LifecycleError(
      "These steps open while your placement is being prepared — check back soon.",
    );
  }
  if (task.status === OnboardingTaskStatus.COMPLETE) {
    throw new LifecycleError("This step is already done.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.onboardingTask.updateMany({
      where: { id: taskId, status: OnboardingTaskStatus.NOT_STARTED },
      data: {
        status: OnboardingTaskStatus.COMPLETE,
        completedAt: new Date(),
        completedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("This step just changed. Refresh and try again.");
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "onboardingTask.complete",
        subjectType: "OnboardingTask",
        subjectId: taskId,
        detail: "placement-task (participant)",
      },
    });
  });
}

// --- Funding assignments (Story 5.3; ADR-010) -------------------------------------

function requireFundingAssignAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "funding.assign")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

/** Money and hour caps: digits with up to two decimals — Decimal-safe. */
const MONEY_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;

export interface AssignFundingInput {
  fundingSourceId: string;
  startDate: Date;
  hourlyRate: string | null;
  hoursCap: string | null;
}

/**
 * Create the placement's ACTIVE funding assignment (AC1). Exactly one at
 * a time (ADR-010): the application check names the rule and the partial
 * unique index backstops the race (AC2). Amount fields are validated as
 * decimal-shaped strings and stored as Decimal — never floating point.
 */
export async function assignFunding(
  ctx: AuthContext,
  placementId: string,
  input: AssignFundingInput,
): Promise<void> {
  requireFundingAssignAccess(ctx);

  const [placement, source] = await Promise.all([
    prisma.placement.findUnique({
      where: { id: placementId },
      select: { id: true },
    }),
    prisma.fundingSource.findUnique({
      where: { id: input.fundingSourceId },
      select: { id: true, status: true },
    }),
  ]);
  if (!placement) throw new NotFoundError();
  if (!source || source.status !== ActiveStatus.ACTIVE) {
    throw new ValidationError("Choose an active funding source.");
  }
  if (Number.isNaN(input.startDate.getTime())) {
    throw new ValidationError("Provide an effective start date.");
  }
  for (const [label, value] of [
    ["hourly rate", input.hourlyRate],
    ["hours cap", input.hoursCap],
  ] as const) {
    if (value !== null && !MONEY_PATTERN.test(value)) {
      throw new ValidationError(
        `The ${label} must be a number like 18 or 18.50 (up to two decimals).`,
      );
    }
  }

  const existingActive = await prisma.fundingAssignment.count({
    where: { placementId, status: FundingAssignmentStatus.ACTIVE },
  });
  if (existingActive > 0) {
    throw new ConflictError(
      "This placement already has an active funding assignment — end it before assigning a new one (one active assignment at a time).",
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.fundingAssignment.create({
        data: {
          placementId,
          fundingSourceId: source.id,
          startDate: input.startDate,
          hourlyRate: input.hourlyRate ? new Prisma.Decimal(input.hourlyRate) : null,
          hoursCap: input.hoursCap ? new Prisma.Decimal(input.hoursCap) : null,
          assignedByUserId: ctx.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: ctx.userId,
          action: "funding.assign",
          subjectType: "Placement",
          subjectId: placementId,
        },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new ConflictError(
        "This placement already has an active funding assignment — end it before assigning a new one (one active assignment at a time).",
      );
    }
    throw error;
  }
}

/**
 * End the active assignment (AC3): marked ENDED with its end date and
 * preserved forever in the Funding tab history — never deleted.
 */
export async function endFundingAssignment(
  ctx: AuthContext,
  placementId: string,
  endDate: Date,
): Promise<void> {
  requireFundingAssignAccess(ctx);

  if (Number.isNaN(endDate.getTime())) {
    throw new ValidationError("Provide an end date.");
  }
  const active = await prisma.fundingAssignment.findFirst({
    where: { placementId, status: FundingAssignmentStatus.ACTIVE },
    select: { id: true, startDate: true },
  });
  if (!active) {
    throw new LifecycleError("This placement has no active funding assignment to end.");
  }
  if (endDate < active.startDate) {
    throw new ValidationError("The end date cannot be before the assignment started.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.fundingAssignment.updateMany({
      where: { id: active.id, status: FundingAssignmentStatus.ACTIVE },
      data: {
        status: FundingAssignmentStatus.ENDED,
        endDate,
        endedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This assignment changed while you were working. Refresh and try again.",
      );
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "funding.end",
        subjectType: "Placement",
        subjectId: placementId,
      },
    });
  });
}

export interface PackageReviewRow {
  id: string;
  placementNumber: string;
  participantName: string;
  siteName: string;
}

/** Packages awaiting this shelter's review (the manager's queue). */
export async function listShelterPackageReviews(
  ctx: AuthContext,
): Promise<PackageReviewRow[]> {
  if (!hasPermission(ctx, "placement.view")) {
    throw new AuthorizationError();
  }
  const organizationIds = ctx.memberships
    .filter((membership) => SHELTER_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  if (organizationIds.length === 0) {
    throw new AuthorizationError();
  }
  const placements = await prisma.placement.findMany({
    where: {
      hostOrganizationId: { in: organizationIds },
      status: PlacementStatus.SHELTER_REVIEW,
    },
    include: {
      participant: {
        include: { person: { select: { legalFirstName: true, legalLastName: true } } },
      },
      organizationSite: { select: { name: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  return placements.map((placement) => ({
    id: placement.id,
    placementNumber: placement.placementNumber,
    participantName: `${placement.participant.person.legalFirstName} ${placement.participant.person.legalLastName}`,
    siteName: placement.organizationSite.name,
  }));
}
