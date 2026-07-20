import {
  ActiveStatus,
  FundingAssignmentStatus,
  OnboardingTaskStatus,
  OrganizationKind,
  PlacementStatus,
  Prisma,
  Role,
  ScheduleDay,
  IncidentStatus,
  type EnrollmentStatus,
  type EvaluationRating,
  type IncidentCategory,
  type IncidentSeverity,
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
  PLACEMENT_STATUS_TONES,
  resumeEventDetail,
  scheduleValidationError,
  TERMINAL_OUTCOMES,
  TERMINAL_PLACEMENT_STATUSES,
  terminalEventDetail,
  terminationReasonLabel,
  type ScheduleDayInput,
  type TimelineStage,
} from "@/server/domain/placement";
import {
  activationBlocksApply,
  openActivationBlockers,
  type ActivationPrerequisiteKey,
  type ActivationSnapshot,
} from "@/server/domain/placement-activation";
import {
  EVALUATION_AREAS,
  EVALUATION_RATING_LABELS,
  EVALUATION_SUBMITTABLE_STATUSES,
  evaluationValidationError,
  type EvaluationInput,
} from "@/server/domain/evaluation";
import {
  assertIncidentTransition,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_REPORTABLE_STATUSES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_TONES,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_TONES,
  incidentValidationError,
  URGENT_INCIDENT_SEVERITIES,
  type IncidentInput,
} from "@/server/domain/incident";
import { computeMatchingReadiness } from "@/server/domain/matching-readiness";
import {
  TIMESHEET_STATUS_LABELS as TIMESHEET_STATUS_LABELS_FOR_HOURS,
  weekLabel,
} from "@/server/domain/timesheet";
import { loadReadinessInputs } from "@/server/services/readiness-service";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import type { BadgeTone } from "@/components/ui/badge";

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
  /**
   * Internal case notes (Story 5.9): Nova viewers holding caseNote.view
   * ONLY. Optional-and-undefined (never null) for every other viewer —
   * JSON serialization drops undefined keys, so neither note content nor
   * the field itself exists in shelter and participant payloads, and the
   * query never even runs for them.
   */
  caseNotes?: CaseNoteTabView;
  /**
   * Workplace evaluations (Story 5.10): shelter viewers (their own
   * organization's placement) and Nova viewers holding evaluation.view.
   * Undefined otherwise — participant visibility is an open policy
   * question and defaults closed (open-questions.md #5).
   */
  evaluations?: EvaluationsTabView;
  /**
   * Incidents (Story 5.11): viewers holding incident.view — shelter
   * staff (org-scoped by the workspace gate) and Nova Operations.
   * Restricted narratives ride ONLY views holding incident.viewRestricted
   * and every delivery is audited.
   */
  incidents?: IncidentsTabView;
  /**
   * The Hours tab (Story 6.5): the placement's weekly timesheets for
   * viewers holding timesheet.view — shelter staff and Nova Operations.
   */
  hoursRows?: HoursTabRow[];
  /**
   * Terminal-outcome controls (Story 5.8; ADR-018): Nova viewers on an
   * Active or Paused placement. Terminate is separately permission-gated.
   */
  viewerCanRecordOutcome: boolean;
  viewerCanTerminate: boolean;
  /** The Employment Outcome once converted (Story 5.8 AC2). */
  outcome: EmploymentOutcomeView | null;
}

export interface HoursTabRow {
  timesheetId: string;
  weekLabel: string;
  statusLabel: string;
  totalHours: string;
  submittedAtLabel: string | null;
}

export interface EmploymentOutcomeView {
  hiredOnLabel: string;
  employerName: string;
  jobTitle: string | null;
}

export interface IncidentFollowUpView {
  id: string;
  authorName: string;
  body: string;
  atLabel: string;
}

export interface IncidentView {
  id: string;
  incidentNumber: string;
  categoryLabel: string;
  severityKey: IncidentSeverity;
  severityLabel: string;
  statusKey: IncidentStatus;
  statusLabel: string;
  statusTone: BadgeTone;
  occurredOnLabel: string;
  reportedByName: string;
  reportedAtLabel: string;
  description: string;
  /** Highly restricted narrative — present ONLY for incident.viewRestricted. */
  restrictedDetail?: string;
  followUps: IncidentFollowUpView[];
  closureOutcome: string | null;
  closedByName: string | null;
  closedAtLabel: string | null;
  viewerCanFollowUp: boolean;
  viewerCanReview: boolean;
}

export interface IncidentsTabView {
  entries: IncidentView[];
  viewerCanReport: boolean;
}

export interface EvaluationRatingView {
  areaLabel: string;
  ratingLabel: string;
}

export interface EvaluationView {
  id: string;
  authorName: string;
  evaluationDateLabel: string;
  submittedAtLabel: string;
  ratings: EvaluationRatingView[];
  strengths: string;
  growthAreas: string | null;
}

export interface EvaluationsTabView {
  /** Newest first. */
  entries: EvaluationView[];
  /** Shelter staff with evaluation.create while Active/Paused. */
  viewerCanSubmit: boolean;
}

export interface CaseNoteRevisionView {
  priorBody: string;
  editorName: string;
  atLabel: string;
}

export interface PlacementCaseNoteView {
  id: string;
  authorName: string;
  body: string;
  atLabel: string;
  /** Prior versions, newest first — edits never overwrite silently (AC5). */
  revisions: CaseNoteRevisionView[];
}

export interface CaseNoteTabView {
  notes: PlacementCaseNoteView[];
  viewerCanCreate: boolean;
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
  /** The one live assignment (ADR-010) — the UI keys icon and emphasis off this, never off the label text. */
  active: boolean;
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
      employmentOutcome: true,
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
    // Permission-shaped tabs: Case Notes needs caseNote.view (5.9) and
    // Evaluations needs evaluation.view (5.10) for Nova viewers — a Grant
    // Administrator gets the workspace without either. Structural
    // absence, not hiding, at every tier; shelter tabs are org-scoped by
    // the workspace gate itself.
    tabs:
      viewer === "NOVA"
        ? NOVA_TABS.filter(
            (tab) =>
              (tab !== "caseNotes" || hasPermission(ctx, "caseNote.view")) &&
              (tab !== "evaluations" || hasPermission(ctx, "evaluation.view")) &&
              (tab !== "incidents" || hasPermission(ctx, "incident.view")),
          )
        : [...SHELTER_TABS],
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
    caseNotes:
      viewer === "NOVA" && hasPermission(ctx, "caseNote.view")
        ? await buildCaseNotesTab(ctx, placement.id)
        : undefined,
    evaluations:
      viewer === "SHELTER" ||
      (viewer === "NOVA" && hasPermission(ctx, "evaluation.view"))
        ? await buildEvaluationsTab(ctx, viewer, placement)
        : undefined,
    incidents: hasPermission(ctx, "incident.view")
      ? await buildIncidentsTab(ctx, viewer, placement)
      : undefined,
    hoursRows: hasPermission(ctx, "timesheet.view")
      ? (
          await prisma.timesheet.findMany({
            where: { placementId: placement.id },
            orderBy: { weekStartDate: "desc" },
          })
        ).map((timesheet) => ({
          timesheetId: timesheet.id,
          weekLabel: weekLabel(timesheet.weekStartDate),
          statusLabel: TIMESHEET_STATUS_LABELS_FOR_HOURS[timesheet.status],
          totalHours: timesheet.totalHours.toFixed(2),
          submittedAtLabel: timesheet.submittedAt
            ? formatDateTime(timesheet.submittedAt)
            : null,
        }))
      : undefined,
    viewerCanRecordOutcome:
      viewer === "NOVA" &&
      hasPermission(ctx, "placement.complete") &&
      (placement.status === PlacementStatus.ACTIVE ||
        placement.status === PlacementStatus.PAUSED),
    viewerCanTerminate:
      viewer === "NOVA" &&
      hasPermission(ctx, "placement.terminate") &&
      (placement.status === PlacementStatus.ACTIVE ||
        placement.status === PlacementStatus.PAUSED),
    outcome: placement.employmentOutcome
      ? {
          hiredOnLabel: formatDate(placement.employmentOutcome.hiredOn) ?? "",
          employerName: placement.employmentOutcome.employerName,
          jobTitle: placement.employmentOutcome.jobTitle,
        }
      : null,
  };
}

// --- Terminal outcomes (Story 5.8; ADR-018) -----------------------------------------

export type TerminalOutcomeKey =
  | "COMPLETED"
  | "CONVERTED_TO_PERMANENT"
  | "WITHDRAWN"
  | "TERMINATED";

export interface TerminalOutcomeInput {
  outcome: TerminalOutcomeKey;
  effectiveDate: Date;
  /** Withdrawn: the participant's stated reason (required). Terminated:
   * required context. Completed: optional. Converted: optional title note. */
  note: string | null;
  /** Terminated only — an ADR-018 reason category key. */
  reasonCategory?: string;
  /** Converted only — who hired the participant. */
  employerName?: string;
  jobTitle?: string | null;
}

/**
 * Record one of the four terminal outcomes (Story 5.8). Nova Operations
 * only, single actor (ADR-018): placement.complete for Completed,
 * Converted to Permanent Employment, and Withdrawn; placement.terminate
 * for Terminated with a required reason category. One transaction:
 * compare-and-set on the loaded status (a racing transition conflicts,
 * never double-writes), the lifecycle event with the ops-internal reason
 * detail, the Employment Outcome row for conversions (AC2), and the
 * audit event — whose detail carries the outcome or reason CATEGORY,
 * never free-text notes. Terminal states are never reopened: the
 * transition table admits nothing out of them.
 */
export async function recordTerminalOutcome(
  ctx: AuthContext,
  placementId: string,
  input: TerminalOutcomeInput,
): Promise<void> {
  const target = PlacementStatus[input.outcome];
  const outcomeRule = TERMINAL_OUTCOMES.find((entry) => entry.status === target);
  if (!outcomeRule) throw new ValidationError("Choose a valid outcome.");
  if (!hasPermission(ctx, outcomeRule.permission)) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, participantId: true },
  });
  if (!placement) throw new NotFoundError();
  assertPlacementTransition(placement.status, target);

  if (Number.isNaN(input.effectiveDate.getTime())) {
    throw new ValidationError("Provide the effective date.");
  }
  const note = input.note?.trim() ? input.note.trim() : null;
  if (note && note.length > 2000) {
    throw new ValidationError("Keep the summary under 2,000 characters.");
  }

  let reasonLabel: string | undefined;
  if (target === PlacementStatus.TERMINATED) {
    reasonLabel = terminationReasonLabel(input.reasonCategory ?? "") ?? undefined;
    if (!reasonLabel) {
      throw new ValidationError("Choose the termination reason category.");
    }
    if (!note) {
      throw new ValidationError(
        "Record what happened before terminating — the note is required.",
      );
    }
  }
  if (target === PlacementStatus.WITHDRAWN && !note) {
    throw new ValidationError("Record the participant's stated reason.");
  }
  const employerName = input.employerName?.trim();
  if (target === PlacementStatus.CONVERTED_TO_PERMANENT && !employerName) {
    throw new ValidationError("Name the employer who hired the participant.");
  }

  const detail = terminalEventDetail({
    status: target,
    effectiveDateLabel: formatDate(input.effectiveDate) ?? "",
    reasonLabel,
    note,
    employerName,
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.placement.updateMany({
      where: { id: placementId, status: placement.status },
      data: { status: target, endDate: input.effectiveDate },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This placement changed while you were working. Review the latest state.",
      );
    }
    await tx.placementEvent.create({
      data: {
        placementId,
        fromStatus: placement.status,
        toStatus: target,
        actorUserId: ctx.userId,
        detail,
      },
    });
    if (target === PlacementStatus.CONVERTED_TO_PERMANENT) {
      await tx.employmentOutcome.create({
        data: {
          placementId,
          participantId: placement.participantId,
          hiredOn: input.effectiveDate,
          employerName: employerName!,
          jobTitle: input.jobTitle?.trim() ? input.jobTitle.trim() : null,
          recordedByUserId: ctx.userId,
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: outcomeRule.permission,
        subjectType: "Placement",
        subjectId: placementId,
        detail: reasonLabel
          ? `Terminated (${reasonLabel})`
          : PLACEMENT_STATUS_LABELS[target],
      },
    });
  });
}

/**
 * The Evaluations tab (Story 5.10): shelter staff see and submit their
 * own organization's placement evaluations (mvp.md Shelter Portal); Nova
 * Operations reads all in scope. Submissions are immutable — corrections
 * are new evaluations — so listing is the whole read surface.
 */
async function buildEvaluationsTab(
  ctx: AuthContext,
  viewer: WorkspaceViewer,
  placement: { id: string; status: PlacementStatus },
): Promise<EvaluationsTabView> {
  const evaluations = await prisma.evaluation.findMany({
    where: { placementId: placement.id },
    orderBy: { submittedAt: "desc" },
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(evaluations.map((entry) => entry.authorUserId))] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(authors.map((user) => [user.id, user.displayName]));

  return {
    entries: evaluations.map((entry) => ({
      id: entry.id,
      authorName: nameById.get(entry.authorUserId) ?? "Unknown user",
      evaluationDateLabel: formatDate(entry.evaluationDate) ?? "",
      submittedAtLabel: formatDateTime(entry.submittedAt),
      ratings: [
        {
          areaLabel: EVALUATION_AREAS[0].label,
          ratingLabel: EVALUATION_RATING_LABELS[entry.reliabilityRating],
        },
        {
          areaLabel: EVALUATION_AREAS[1].label,
          ratingLabel: EVALUATION_RATING_LABELS[entry.taskQualityRating],
        },
        {
          areaLabel: EVALUATION_AREAS[2].label,
          ratingLabel: EVALUATION_RATING_LABELS[entry.teamworkRating],
        },
      ],
      strengths: entry.strengths,
      growthAreas: entry.growthAreas,
    })),
    viewerCanSubmit:
      viewer === "SHELTER" &&
      hasPermission(ctx, "evaluation.create") &&
      EVALUATION_SUBMITTABLE_STATUSES.includes(placement.status),
  };
}

/**
 * Submit a workplace evaluation (Story 5.10 AC1). Shelter Supervisors
 * and Managers only, scoped to their own organization's placement (AC3),
 * while the placement is Active or Paused (AC5) — earlier stages have no
 * workplace performance to evaluate. Immutable once saved (AC4): no
 * update path exists; a correction is a new submission.
 */
export async function submitEvaluation(
  ctx: AuthContext,
  placementId: string,
  input: EvaluationInput,
): Promise<void> {
  if (!hasPermission(ctx, "evaluation.create")) {
    throw new AuthorizationError();
  }

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, hostOrganizationId: true },
  });
  if (!placement) throw new NotFoundError();

  const isHostShelterStaff = ctx.memberships.some(
    (membership) =>
      SHELTER_ROLES.includes(membership.role) &&
      membership.organizationId === placement.hostOrganizationId,
  );
  if (!isHostShelterStaff) {
    throw new AuthorizationError();
  }
  if (!EVALUATION_SUBMITTABLE_STATUSES.includes(placement.status)) {
    throw new LifecycleError(
      "Evaluations are submitted while the placement is active or paused.",
    );
  }

  const problem = evaluationValidationError(input);
  if (problem) throw new ValidationError(problem);

  await prisma.evaluation.create({
    data: {
      placementId,
      authorUserId: ctx.userId,
      evaluationDate: input.evaluationDate,
      // Validated against the rating enum above — the cast is sound.
      reliabilityRating: input.ratings.reliability as EvaluationRating,
      taskQualityRating: input.ratings.taskQuality as EvaluationRating,
      teamworkRating: input.ratings.teamwork as EvaluationRating,
      strengths: input.strengths.trim(),
      growthAreas: input.growthAreas?.trim() ? input.growthAreas.trim() : null,
    },
  });
}

// --- Incidents (Story 5.11; docs/ops/incident-response.md) --------------------------

/**
 * The Incidents tab (Story 5.11). Every incident.view holder reads the
 * operational record; the HIGHLY RESTRICTED narrative rides only views
 * holding incident.viewRestricted, and each delivered narrative writes
 * an AuditEvent in the same request (security-privacy.md: audit
 * sensitive access; the audit record itself carries no sensitive
 * content). There is no other query path to restrictedDetail —
 * exclusion from general views is structural, not cosmetic (AC5).
 */
async function buildIncidentsTab(
  ctx: AuthContext,
  viewer: WorkspaceViewer,
  placement: { id: string; status: PlacementStatus },
): Promise<IncidentsTabView> {
  const incidents = await prisma.incident.findMany({
    where: { placementId: placement.id },
    include: { followUps: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const userIds = new Set<string>();
  for (const incident of incidents) {
    userIds.add(incident.reporterUserId);
    if (incident.closedByUserId) userIds.add(incident.closedByUserId);
    for (const followUp of incident.followUps) userIds.add(followUp.authorUserId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((user) => [user.id, user.displayName]));

  const canReadRestricted = hasPermission(ctx, "incident.viewRestricted");
  const delivered = incidents.filter(
    (incident) => canReadRestricted && incident.restrictedDetail !== null,
  );
  if (delivered.length > 0) {
    await prisma.auditEvent.createMany({
      data: delivered.map((incident) => ({
        actorUserId: ctx.userId,
        action: "incident.viewRestricted",
        subjectType: "Incident",
        subjectId: incident.id,
      })),
    });
  }

  return {
    entries: incidents.map((incident) => ({
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      categoryLabel: INCIDENT_CATEGORY_LABELS[incident.category],
      severityKey: incident.severity,
      severityLabel: INCIDENT_SEVERITY_LABELS[incident.severity],
      statusKey: incident.status,
      statusLabel: INCIDENT_STATUS_LABELS[incident.status],
      statusTone: INCIDENT_STATUS_TONES[incident.status],
      occurredOnLabel: formatDate(incident.occurredOn) ?? "",
      reportedByName: nameById.get(incident.reporterUserId) ?? "Unknown user",
      reportedAtLabel: formatDateTime(incident.createdAt),
      description: incident.description,
      ...(canReadRestricted && incident.restrictedDetail !== null
        ? { restrictedDetail: incident.restrictedDetail }
        : {}),
      followUps: incident.followUps.map((followUp) => ({
        id: followUp.id,
        authorName: nameById.get(followUp.authorUserId) ?? "Unknown user",
        body: followUp.body,
        atLabel: formatDateTime(followUp.createdAt),
      })),
      closureOutcome: incident.closureOutcome,
      closedByName: incident.closedByUserId
        ? (nameById.get(incident.closedByUserId) ?? "Nova staff")
        : null,
      closedAtLabel: incident.closedAt ? formatDateTime(incident.closedAt) : null,
      viewerCanFollowUp:
        hasPermission(ctx, "incident.create") &&
        incident.status !== IncidentStatus.CLOSED,
      viewerCanReview:
        viewer === "NOVA" &&
        hasPermission(ctx, "incident.review") &&
        incident.status !== IncidentStatus.CLOSED,
    })),
    viewerCanReport:
      hasPermission(ctx, "incident.create") &&
      INCIDENT_REPORTABLE_STATUSES.includes(placement.status),
  };
}

/** INC-YYYY-XXXXXX per database-design.md, retried on the rare collision. */
function generateIncidentNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INC-${year}-${suffix}`;
}

/**
 * Report an incident (AC1). Shelter staff report against their own
 * organization's placements; Nova Operations against any in scope. The
 * placement must be at/past Onboarding — site activity exists to report
 * on — including terminal stages (issues surface shortly after an end).
 * Submission is documentation and notification, never emergency response
 * (RULES.md); Serious/Emergency surface on the Operations dashboard's
 * urgent queue by query (AC2), messaging being V2.
 */
export async function submitIncident(
  ctx: AuthContext,
  placementId: string,
  input: IncidentInput,
): Promise<void> {
  if (!hasPermission(ctx, "incident.create")) {
    throw new AuthorizationError();
  }
  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true, status: true, hostOrganizationId: true },
  });
  if (!placement) throw new NotFoundError();

  const isHostShelterStaff = ctx.memberships.some(
    (membership) =>
      SHELTER_ROLES.includes(membership.role) &&
      membership.organizationId === placement.hostOrganizationId,
  );
  if (!isHostShelterStaff && !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  if (!INCIDENT_REPORTABLE_STATUSES.includes(placement.status)) {
    throw new LifecycleError(
      "Incidents are reported once the placement has reached onboarding — there is no site activity to report before then.",
    );
  }
  const problem = incidentValidationError(input);
  if (problem) throw new ValidationError(problem);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.incident.create({
        data: {
          incidentNumber: generateIncidentNumber(),
          placementId,
          category: input.category as IncidentCategory,
          severity: input.severity as IncidentSeverity,
          occurredOn: input.occurredOn,
          reporterUserId: ctx.userId,
          description: input.description.trim(),
          restrictedDetail: input.restrictedDetail?.trim()
            ? input.restrictedDetail.trim()
            : null,
        },
      });
      return;
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isNumberCollision || attempt === 2) throw error;
    }
  }
}

/**
 * Append-only follow-up (AC3): shelter staff and Nova add context while
 * the incident is open or under review. Category, severity, and closure
 * are never shelter-editable — no such write surface exists for them.
 */
export async function addIncidentFollowUp(
  ctx: AuthContext,
  incidentId: string,
  body: string,
): Promise<void> {
  if (!hasPermission(ctx, "incident.create")) {
    throw new AuthorizationError();
  }
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      status: true,
      placement: { select: { hostOrganizationId: true } },
    },
  });
  if (!incident) throw new NotFoundError();

  const isHostShelterStaff = ctx.memberships.some(
    (membership) =>
      SHELTER_ROLES.includes(membership.role) &&
      membership.organizationId === incident.placement.hostOrganizationId,
  );
  if (!isHostShelterStaff && !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  if (incident.status === IncidentStatus.CLOSED) {
    throw new LifecycleError("A closed incident is read-only history.");
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Write the follow-up before saving it.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep follow-ups under 4,000 characters.");
  }

  await prisma.incidentFollowUp.create({
    data: { incidentId, authorUserId: ctx.userId, body: trimmed },
  });
}

/** Nova takes the incident under review (AC4) — audited. */
export async function startIncidentReview(
  ctx: AuthContext,
  incidentId: string,
): Promise<void> {
  if (!hasPermission(ctx, "incident.review")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, status: true },
  });
  if (!incident) throw new NotFoundError();
  assertIncidentTransition(incident.status, IncidentStatus.UNDER_REVIEW);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.updateMany({
      where: { id: incidentId, status: IncidentStatus.OPEN },
      data: {
        status: IncidentStatus.UNDER_REVIEW,
        reviewStartedAt: new Date(),
        reviewerUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This incident changed while you were working. Refresh and try again.",
      );
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "incident.review",
        subjectType: "Incident",
        subjectId: incidentId,
        detail: "review started",
      },
    });
  });
}

/**
 * Close the incident (AC4): reviewer, timestamp, and outcome recorded in
 * one transaction; the record becomes read-only history (AC6 — archival
 * states only, never deletion). The outcome text stays out of audit
 * detail — non-sensitive codes only.
 */
export async function closeIncident(
  ctx: AuthContext,
  incidentId: string,
  outcome: string,
): Promise<void> {
  if (!hasPermission(ctx, "incident.review")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, status: true },
  });
  if (!incident) throw new NotFoundError();
  assertIncidentTransition(incident.status, IncidentStatus.CLOSED);

  const trimmed = outcome.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(
      "Record the outcome before closing — what was reviewed and decided.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.incident.updateMany({
      where: {
        id: incidentId,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.UNDER_REVIEW] },
      },
      data: {
        status: IncidentStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: ctx.userId,
        closureOutcome: trimmed,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This incident changed while you were working. Refresh and try again.",
      );
    }
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "incident.close",
        subjectType: "Incident",
        subjectId: incidentId,
        detail: "closed",
      },
    });
  });
}

export interface UrgentIncidentRow {
  incidentId: string;
  incidentNumber: string;
  placementId: string;
  placementNumber: string;
  participantName: string;
  severityLabel: string;
  severityTone: BadgeTone;
  categoryLabel: string;
  statusLabel: string;
  reportedAtLabel: string;
}

/**
 * The Operations dashboard's urgent-incident surface (AC2): every OPEN
 * or UNDER_REVIEW incident at Serious/Emergency severity, newest first —
 * always visible in-app, since real-time messaging is V2. Restricted
 * narratives never ride this list.
 */
export async function listUrgentIncidents(
  ctx: AuthContext,
): Promise<UrgentIncidentRow[]> {
  if (!hasPermission(ctx, "incident.review") || !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }
  const incidents = await prisma.incident.findMany({
    where: {
      severity: { in: [...URGENT_INCIDENT_SEVERITIES] },
      status: { in: [IncidentStatus.OPEN, IncidentStatus.UNDER_REVIEW] },
    },
    include: {
      placement: {
        select: {
          id: true,
          placementNumber: true,
          participant: {
            select: {
              person: { select: { legalFirstName: true, legalLastName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return incidents.map((incident) => ({
    incidentId: incident.id,
    incidentNumber: incident.incidentNumber,
    placementId: incident.placement.id,
    placementNumber: incident.placement.placementNumber,
    participantName: `${incident.placement.participant.person.legalFirstName} ${incident.placement.participant.person.legalLastName}`,
    severityLabel: INCIDENT_SEVERITY_LABELS[incident.severity],
    severityTone: INCIDENT_SEVERITY_TONES[incident.severity],
    categoryLabel: INCIDENT_CATEGORY_LABELS[incident.category],
    statusLabel: INCIDENT_STATUS_LABELS[incident.status],
    reportedAtLabel: formatDateTime(incident.createdAt),
  }));
}

/**
 * The Case Notes tab (Story 5.9) — queried ONLY for authorized Nova
 * viewers; the query never runs for shelter or participant requests, so
 * note content cannot enter their payloads. Notes and their revision
 * history are Nova-internal coordination records at every lifecycle
 * stage, including terminal (AC6).
 */
async function buildCaseNotesTab(
  ctx: AuthContext,
  placementId: string,
): Promise<CaseNoteTabView> {
  const notes = await prisma.caseNote.findMany({
    where: { placementId },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const userIds = new Set<string>();
  for (const note of notes) {
    userIds.add(note.authorUserId);
    for (const revision of note.revisions) userIds.add(revision.editedByUserId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((user) => [user.id, user.displayName]));

  return {
    notes: notes.map((note) => ({
      id: note.id,
      authorName: nameById.get(note.authorUserId) ?? "Unknown user",
      body: note.body,
      atLabel: formatDateTime(note.createdAt),
      revisions: note.revisions.map((revision) => ({
        priorBody: revision.priorBody,
        editorName: nameById.get(revision.editedByUserId) ?? "Unknown user",
        atLabel: formatDateTime(revision.createdAt),
      })),
    })),
    viewerCanCreate: hasPermission(ctx, "caseNote.create"),
  };
}

/**
 * Add an internal note to a placement (Story 5.9 AC1). Nova Operations
 * only; allowed at ANY lifecycle stage including terminal — coordination
 * history continues to matter after a placement ends. Validation copy
 * matches the 2.7 application-note path; note content never reaches
 * audit records or any non-Nova view model.
 */
export async function addPlacementCaseNote(
  ctx: AuthContext,
  placementId: string,
  body: string,
): Promise<void> {
  if (!hasPermission(ctx, "caseNote.create")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const placement = await prisma.placement.findUnique({
    where: { id: placementId },
    select: { id: true },
  });
  if (!placement) throw new NotFoundError();

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Write the note before saving it.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep notes under 4,000 characters.");
  }

  await prisma.caseNote.create({
    data: { placementId, authorUserId: ctx.userId, body: trimmed },
  });
}

/**
 * Edit a placement note with history (Story 5.9 AC5): the prior content
 * is archived as an append-only revision in the same transaction — never
 * overwritten silently. The compare-and-set on updatedAt turns a
 * concurrent edit into a clean conflict instead of a lost version.
 */
export async function editPlacementCaseNote(
  ctx: AuthContext,
  noteId: string,
  body: string,
): Promise<void> {
  if (!hasPermission(ctx, "caseNote.create")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);

  const note = await prisma.caseNote.findUnique({
    where: { id: noteId },
    select: { id: true, placementId: true, body: true, updatedAt: true },
  });
  if (!note || !note.placementId) throw new NotFoundError();

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Write the note before saving it.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Keep notes under 4,000 characters.");
  }
  if (trimmed === note.body) {
    throw new ValidationError("Make a change before saving.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.caseNote.updateMany({
      where: { id: noteId, updatedAt: note.updatedAt },
      data: { body: trimmed },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This note changed while you were editing. Review the latest version.",
      );
    }
    await tx.caseNoteRevision.create({
      data: {
        caseNoteId: noteId,
        priorBody: note.body,
        editedByUserId: ctx.userId,
      },
    });
  });
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
    active: assignment.status === FundingAssignmentStatus.ACTIVE,
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
  statusTone: BadgeTone;
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
    statusTone: PLACEMENT_STATUS_TONES[placement.status],
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
  /**
   * True while the placement occupies the active tier (Onboarding /
   * Active / Paused). The participant home's placed state keys off this
   * boolean — internal status names never enter the participant payload.
   */
  active: boolean;
  /** The participant's own placement-onboarding steps (Story 5.4). */
  mySteps: ParticipantStepView[];
}

/** Shared shape for both getOwnPlacement lookups (active-tier, fallback). */
const OWN_PLACEMENT_INCLUDE = {
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
} satisfies Prisma.PlacementInclude;

/**
 * The participant's own "My Placement" view (AC3): ownership-scoped,
 * plain language — no case notes, no internal blocker codes, no other
 * participants' data (structurally impossible: only their own record is
 * queried).
 */
export async function getOwnPlacement(
  ctx: AuthContext,
): Promise<ParticipantPlacementView | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;

  // The placement of record: the active-tier one when it exists (the
  // one-active-placement partial unique index guarantees at most one),
  // else the most recent — so a newer terminal record never hides a
  // participant's live placement, and history stays readable after an end.
  const placement =
    (await prisma.placement.findFirst({
      where: {
        participantId: person.participant.id,
        status: { in: [...ACTIVE_PLACEMENT_STATUSES] },
      },
      include: OWN_PLACEMENT_INCLUDE,
    })) ??
    (await prisma.placement.findFirst({
      where: { participantId: person.participant.id },
      orderBy: { createdAt: "desc" },
      include: OWN_PLACEMENT_INCLUDE,
    }));
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
    active: (ACTIVE_PLACEMENT_STATUSES as readonly PlacementStatus[]).includes(
      placement.status,
    ),
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
