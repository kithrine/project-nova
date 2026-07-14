import {
  PlacementStatus,
  Prisma,
  Role,
  TimesheetStatus,
} from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  isoDate,
  mondayOfWeek,
  nextWeek,
  PARTICIPANT_EDITABLE_TIMESHEET_STATUSES,
  parseWeekParam,
  previousWeek,
  reviewDenialReason,
  TIMESHEET_STATUS_LABELS,
  weekCreationBlockReason,
  weekEndFor,
  weekLabel,
} from "@/server/domain/timesheet";
import {
  hoursStringFromHundredths,
  shiftHourHundredths,
  shiftValidationError,
  totalHoursString,
} from "@/server/domain/work-hours";
import {
  AuthorizationError,
  ConflictError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

/**
 * TimesheetService (Epic 6; api-service-design.md). Story 6.1 owns the
 * idempotent weekly get-or-create for the participant's OWN placement:
 * every operation resolves ownership server-side through the Person ->
 * Participant chain — a client-supplied placement or participant id is
 * never part of the contract (AC6). Weeks are Monday-Sunday; at most one
 * timesheet per placement per week, backed by the unique constraint.
 */

export interface WorkEntryView {
  id: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** Server-computed Decimal-shaped string (Story 6.3). */
  hours: string;
  note: string | null;
}

export interface WeekDayView {
  dateIso: string;
  /** "Monday, July 13" */
  dayLabel: string;
  entries: WorkEntryView[];
}

export interface MyHoursWeekView {
  /** Null when the requested week cannot hold a timesheet (with reason). */
  timesheetId: string | null;
  weekStartIso: string;
  weekLabel: string;
  statusKey: TimesheetStatus | null;
  statusLabel: string | null;
  /** Decimal-shaped string — floating point never touches it. */
  totalHours: string | null;
  editable: boolean;
  /** Why this week has no timesheet and cannot create one (AC4/AC5). */
  blockedReason: string | null;
  isCurrentWeek: boolean;
  previousWeekIso: string;
  /** Null at the current week — future weeks are never navigable (AC4). */
  nextWeekIso: string | null;
  /** The week's seven days with entries, oldest day first (Story 6.2). */
  days: WeekDayView[];
  /** The Submit control renders (Story 6.4): DRAFT/REJECTED weeks. */
  viewerCanSubmit: boolean;
  /** Why Submit is disabled (shown, not hidden), or null when armed. */
  submitDisabledReason: string | null;
  /** Plain-language what-happens-next for post-submission statuses. */
  statusNote: string | null;
}

export interface MyHoursView {
  /** Null when the participant has no ACTIVE placement to record against. */
  week: MyHoursWeekView | null;
  siteName: string | null;
  organizationName: string | null;
}

/**
 * Resolve My Hours for the participant's own ACTIVE placement and the
 * requested (or current) week, creating the DRAFT timesheet on first
 * open (AC1). Idempotent: an existing week is reused (AC2), and the
 * unique-constraint race on double-open resolves by refetch, never a
 * duplicate. A week already created stays readable even if the
 * placement later left ACTIVE (AC5) — only NEW creation is gated.
 */
export async function getOrCreateOwnTimesheet(
  ctx: AuthContext,
  requestedWeek?: string,
): Promise<MyHoursView> {
  if (!hasPermission(ctx, "timesheet.create")) {
    throw new AuthorizationError();
  }
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return { week: null, siteName: null, organizationName: null };

  // The participant's placement of record: the one currently ACTIVE, or
  // the most recent one so prior weeks stay readable after a pause/end.
  const placement =
    (await prisma.placement.findFirst({
      where: {
        participantId: person.participant.id,
        status: PlacementStatus.ACTIVE,
      },
      include: {
        organizationSite: {
          select: { name: true, organization: { select: { name: true } } },
        },
      },
    })) ??
    (await prisma.placement.findFirst({
      where: { participantId: person.participant.id },
      orderBy: { createdAt: "desc" },
      include: {
        organizationSite: {
          select: { name: true, organization: { select: { name: true } } },
        },
      },
    }));
  if (!placement) return { week: null, siteName: null, organizationName: null };

  const today = new Date();
  const currentWeek = mondayOfWeek(today);
  const weekStart = parseWeekParam(requestedWeek) ?? currentWeek;
  const isCurrentWeek = weekStart.getTime() === currentWeek.getTime();

  const base = {
    weekStartIso: isoDate(weekStart),
    weekLabel: weekLabel(weekStart),
    isCurrentWeek,
    previousWeekIso: isoDate(previousWeek(weekStart)),
    nextWeekIso: isCurrentWeek ? null : isoDate(nextWeek(weekStart)),
  };

  let timesheet = await prisma.timesheet.findUnique({
    where: {
      placementId_weekStartDate: {
        placementId: placement.id,
        weekStartDate: weekStart,
      },
    },
  });

  if (!timesheet) {
    // Creation gates apply only when nothing exists yet: never a future
    // week (AC4), never before the placement began (AC3's bound), and
    // only while the placement is ACTIVE (AC5).
    const blockedReason =
      placement.status !== PlacementStatus.ACTIVE
        ? "Hours can be recorded while your placement is active."
        : weekCreationBlockReason({
            weekStart,
            today,
            placementStartDate: placement.startDate,
          });
    if (blockedReason) {
      return {
        week: {
          ...base,
          timesheetId: null,
          statusKey: null,
          statusLabel: null,
          totalHours: null,
          editable: false,
          blockedReason,
          days: [],
          viewerCanSubmit: false,
          submitDisabledReason: null,
          statusNote: null,
        },
        siteName: placement.organizationSite.name,
        organizationName: placement.organizationSite.organization.name,
      };
    }

    try {
      timesheet = await prisma.$transaction(async (tx) => {
        const created = await tx.timesheet.create({
          data: {
            placementId: placement.id,
            weekStartDate: weekStart,
            weekEndDate: weekEndFor(weekStart),
          },
        });
        await tx.timesheetEvent.create({
          data: {
            timesheetId: created.id,
            fromStatus: null,
            toStatus: TimesheetStatus.DRAFT,
            actorUserId: ctx.userId,
          },
        });
        return created;
      });
    } catch (error) {
      // Double-open race: the unique constraint held — reuse the winner.
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isDuplicate) throw error;
      timesheet = await prisma.timesheet.findUniqueOrThrow({
        where: {
          placementId_weekStartDate: {
            placementId: placement.id,
            weekStartDate: weekStart,
          },
        },
      });
    }
  }

  const entries = await prisma.workEntry.findMany({
    where: { timesheetId: timesheet.id },
    orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
  });
  const days = buildWeekDays(weekStart, entries);

  const hasEntries = entries.length > 0;
  const editable = PARTICIPANT_EDITABLE_TIMESHEET_STATUSES.includes(timesheet.status);
  return {
    week: {
      ...base,
      timesheetId: timesheet.id,
      statusKey: timesheet.status,
      statusLabel: TIMESHEET_STATUS_LABELS[timesheet.status],
      totalHours: timesheet.totalHours.toFixed(2),
      editable,
      blockedReason: null,
      days,
      viewerCanSubmit: editable,
      submitDisabledReason:
        editable && !hasEntries
          ? "Add at least one work day before submitting."
          : null,
      statusNote:
        timesheet.status === TimesheetStatus.SUBMITTED
          ? "Your hours were submitted for review — your supervisor will take it from here."
          : timesheet.status === TimesheetStatus.APPROVED ||
              timesheet.status === TimesheetStatus.LOCKED
            ? "Your hours for this week were approved."
            : timesheet.status === TimesheetStatus.REJECTED
              ? "Your supervisor asked for a correction — you can edit your entries and resubmit."
              : null,
    },
    siteName: placement.organizationSite.name,
    organizationName: placement.organizationSite.organization.name,
  };
}

// --- Submission (Story 6.4) -----------------------------------------------------

/**
 * Submit the participant's own week for review (AC1/AC3): DRAFT or
 * REJECTED only — resubmission reuses this same action — with at least
 * one entry. One transaction: the total is recalculated FRESH from the
 * current entries (never the last-saved value), the compare-and-set
 * turns a replayed or racing submit into a clean lifecycle conflict
 * (AC4), and the lifecycle event + audit event commit with the status
 * change (AC5). Prior rejection history lives in the append-only event
 * trail and is never discarded.
 */
export async function submitOwnTimesheet(
  ctx: AuthContext,
  timesheetId: string,
): Promise<void> {
  if (!hasPermission(ctx, "timesheet.submit")) {
    throw new AuthorizationError();
  }
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: {
      id: true,
      status: true,
      placement: {
        select: {
          participant: { select: { person: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!timesheet || timesheet.placement.participant.person.userId !== ctx.userId) {
    throw new NotFoundError();
  }
  if (!PARTICIPANT_EDITABLE_TIMESHEET_STATUSES.includes(timesheet.status)) {
    throw new LifecycleError(
      "This week was already submitted — your supervisor is reviewing it.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const entries = await tx.workEntry.findMany({
      where: { timesheetId },
      select: { hours: true },
    });
    if (entries.length === 0) {
      throw new ValidationError("Add at least one work day before submitting.");
    }
    const total = totalHoursString(entries.map((entry) => entry.hours.toFixed(2)));

    const updated = await tx.timesheet.updateMany({
      where: { id: timesheetId, status: timesheet.status },
      data: {
        status: TimesheetStatus.SUBMITTED,
        submittedAt: new Date(),
        totalHours: total,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "This timesheet changed while you were working. Refresh to see its latest state.",
      );
    }
    await tx.timesheetEvent.create({
      data: {
        timesheetId,
        fromStatus: timesheet.status,
        toStatus: TimesheetStatus.SUBMITTED,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "timesheet.submit",
        subjectType: "Timesheet",
        subjectId: timesheetId,
        detail: `${total} hours`,
      },
    });
  });
}

// --- Shelter review (Stories 6.5/6.6) --------------------------------------------

const SHELTER_ROLES: readonly Role[] = [
  Role.SHELTER_SUPERVISOR,
  Role.SHELTER_MANAGER,
];

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

interface ReviewableTimesheet {
  id: string;
  status: TimesheetStatus;
  placement: {
    hostOrganizationId: string;
    supervisorId: string | null;
  };
}

/**
 * Assemble the four facts the canonical standing check decides on
 * (Story 6.5; authorization-rbac.md). The permission code is a
 * parameter because approval (6.5) and rejection (6.6) share the rule.
 */
function reviewStandingFor(
  ctx: AuthContext,
  permission: "timesheet.approve",
  timesheet: ReviewableTimesheet,
) {
  return {
    holdsPermission: hasPermission(ctx, permission),
    isNovaStaff: hasNovaScope(ctx) && hasPermission(ctx, permission),
    isMemberOfHostOrg: ctx.memberships.some(
      (membership) =>
        SHELTER_ROLES.includes(membership.role) &&
        membership.organizationId === timesheet.placement.hostOrganizationId,
    ),
    isAssignedSupervisor: ctx.userId === timesheet.placement.supervisorId,
    isManagerAtHostOrg: ctx.memberships.some(
      (membership) =>
        membership.role === Role.SHELTER_MANAGER &&
        membership.organizationId === timesheet.placement.hostOrganizationId,
    ),
    status: timesheet.status,
  };
}

export interface TimesheetQueueRow {
  timesheetId: string;
  placementId: string;
  participantName: string;
  placementNumber: string;
  weekLabel: string;
  totalHours: string;
  submittedAtLabel: string;
}

/**
 * The shelter Timesheets queue (Story 6.5): SUBMITTED weeks for
 * placements at the member's organization(s), oldest submission first
 * so nothing waits at the back. Nova staff use the workspace Hours tab
 * instead — this queue is the Shelter Portal surface.
 */
export async function listShelterTimesheetQueue(
  ctx: AuthContext,
): Promise<TimesheetQueueRow[]> {
  if (!hasPermission(ctx, "timesheet.view")) {
    throw new AuthorizationError();
  }
  const orgIds = ctx.memberships
    .filter((membership) => SHELTER_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  if (orgIds.length === 0) {
    throw new AuthorizationError();
  }

  const timesheets = await prisma.timesheet.findMany({
    where: {
      status: TimesheetStatus.SUBMITTED,
      placement: { hostOrganizationId: { in: orgIds } },
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
    orderBy: { submittedAt: "asc" },
  });
  return timesheets.map((timesheet) => ({
    timesheetId: timesheet.id,
    placementId: timesheet.placement.id,
    participantName: `${timesheet.placement.participant.person.legalFirstName} ${timesheet.placement.participant.person.legalLastName}`,
    placementNumber: timesheet.placement.placementNumber,
    weekLabel: weekLabel(timesheet.weekStartDate),
    totalHours: timesheet.totalHours.toFixed(2),
    submittedAtLabel: formatDateTime(timesheet.submittedAt ?? timesheet.createdAt),
  }));
}

export interface TimesheetReviewView {
  timesheetId: string;
  placementId: string;
  participantName: string;
  placementNumber: string;
  siteName: string;
  weekLabel: string;
  statusKey: TimesheetStatus;
  statusLabel: string;
  totalHours: string;
  days: WeekDayView[];
  submittedAtLabel: string | null;
  approvedAtLabel: string | null;
  approvedByName: string | null;
  viewerCanApprove: boolean;
}

/**
 * The Timesheet Review Card (Story 6.5): the week's entries and total,
 * read-only — only the participant edits entries — plus the viewer's
 * decision capability computed through the canonical standing check.
 * Readable by shelter members of the host organization and Nova staff.
 */
export async function getTimesheetReview(
  ctx: AuthContext,
  timesheetId: string,
): Promise<TimesheetReviewView> {
  if (!hasPermission(ctx, "timesheet.view")) {
    throw new AuthorizationError();
  }
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: { orderBy: [{ workDate: "asc" }, { startTime: "asc" }] },
      placement: {
        select: {
          id: true,
          placementNumber: true,
          hostOrganizationId: true,
          supervisorId: true,
          organizationSite: { select: { name: true } },
          participant: {
            select: {
              person: { select: { legalFirstName: true, legalLastName: true } },
            },
          },
        },
      },
    },
  });
  if (!timesheet) throw new NotFoundError();

  const isMemberOfHostOrg = ctx.memberships.some(
    (membership) =>
      SHELTER_ROLES.includes(membership.role) &&
      membership.organizationId === timesheet.placement.hostOrganizationId,
  );
  if (!isMemberOfHostOrg && !hasNovaScope(ctx)) {
    throw new AuthorizationError();
  }

  const approvedByName = timesheet.approvedByUserId
    ? ((
        await prisma.user.findUnique({
          where: { id: timesheet.approvedByUserId },
          select: { displayName: true },
        })
      )?.displayName ?? "Staff")
    : null;

  return {
    timesheetId: timesheet.id,
    placementId: timesheet.placement.id,
    participantName: `${timesheet.placement.participant.person.legalFirstName} ${timesheet.placement.participant.person.legalLastName}`,
    placementNumber: timesheet.placement.placementNumber,
    siteName: timesheet.placement.organizationSite.name,
    weekLabel: weekLabel(timesheet.weekStartDate),
    statusKey: timesheet.status,
    statusLabel: TIMESHEET_STATUS_LABELS[timesheet.status],
    totalHours: timesheet.totalHours.toFixed(2),
    days: buildWeekDays(timesheet.weekStartDate, timesheet.entries),
    submittedAtLabel: timesheet.submittedAt
      ? formatDateTime(timesheet.submittedAt)
      : null,
    approvedAtLabel: timesheet.approvedAt
      ? formatDateTime(timesheet.approvedAt)
      : null,
    approvedByName,
    viewerCanApprove:
      reviewDenialReason(
        reviewStandingFor(ctx, "timesheet.approve", timesheet),
      ) === null,
  };
}

/**
 * Approve a submitted week (Story 6.5 AC1) — the canonical four-part
 * check, then one transaction: compare-and-set on SUBMITTED (a racing
 * reviewer gets a clean conflict, AC6), approver identity recorded,
 * lifecycle event and audit event alongside. Approval never touches
 * entries — it confirms the server-calculated hours as-is.
 */
export async function approveTimesheet(
  ctx: AuthContext,
  timesheetId: string,
): Promise<void> {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: {
      id: true,
      status: true,
      totalHours: true,
      placement: { select: { hostOrganizationId: true, supervisorId: true } },
    },
  });
  if (!timesheet) throw new NotFoundError();

  const denial = reviewDenialReason(
    reviewStandingFor(ctx, "timesheet.approve", timesheet),
  );
  if (denial) {
    if (timesheet.status !== TimesheetStatus.SUBMITTED) {
      throw new LifecycleError(denial);
    }
    throw new AuthorizationError(denial);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.timesheet.updateMany({
      where: { id: timesheetId, status: TimesheetStatus.SUBMITTED },
      data: {
        status: TimesheetStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: ctx.userId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        "Another reviewer acted on this timesheet first. Refresh to see its latest state.",
      );
    }
    await tx.timesheetEvent.create({
      data: {
        timesheetId,
        fromStatus: TimesheetStatus.SUBMITTED,
        toStatus: TimesheetStatus.APPROVED,
        actorUserId: ctx.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "timesheet.approve",
        subjectType: "Timesheet",
        subjectId: timesheetId,
        detail: `${timesheet.totalHours.toFixed(2)} hours`,
      },
    });
  });
}

/** The shelter dashboard's awaiting-review count (wireframes-layouts.md). */
export async function countShelterTimesheetsAwaitingReview(
  ctx: AuthContext,
): Promise<number | null> {
  if (!hasPermission(ctx, "timesheet.view")) return null;
  const orgIds = ctx.memberships
    .filter((membership) => SHELTER_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  if (orgIds.length === 0) return null;
  return prisma.timesheet.count({
    where: {
      status: TimesheetStatus.SUBMITTED,
      placement: { hostOrganizationId: { in: orgIds } },
    },
  });
}

/** The seven day buckets for a week's entries (6.1/6.2/6.5 views). */
function buildWeekDays(
  weekStart: Date,
  entries: {
    id: string;
    workDate: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    hours: Prisma.Decimal;
    note: string | null;
  }[],
): WeekDayView[] {
  const days: WeekDayView[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(weekStart.getTime() + offset * 86_400_000);
    const dateIso = isoDate(date);
    days.push({
      dateIso,
      dayLabel: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      entries: entries
        .filter((entry) => isoDate(entry.workDate) === dateIso)
        .map((entry) => ({
          id: entry.id,
          startTime: entry.startTime,
          endTime: entry.endTime,
          breakMinutes: entry.breakMinutes,
          hours: entry.hours.toFixed(2),
          note: entry.note,
        })),
    });
  }
  return days;
}

// --- Work entries (Story 6.2) ---------------------------------------------------

export interface WorkEntryInput {
  workDate: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  note: string | null;
}

/**
 * Resolve a timesheet the authenticated participant OWNS and may edit:
 * permission, Person -> Participant ownership, and the DRAFT/REJECTED
 * lifecycle window, enforced on every mutation server-side (AC2) — the
 * client id is only ever a lookup key, never trusted for scope.
 */
async function loadOwnEditableTimesheet(ctx: AuthContext, timesheetId: string) {
  if (!hasPermission(ctx, "timesheet.edit")) {
    throw new AuthorizationError();
  }
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: {
      id: true,
      status: true,
      weekStartDate: true,
      weekEndDate: true,
      placement: {
        select: {
          participant: { select: { person: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!timesheet || timesheet.placement.participant.person.userId !== ctx.userId) {
    throw new NotFoundError();
  }
  if (!PARTICIPANT_EDITABLE_TIMESHEET_STATUSES.includes(timesheet.status)) {
    throw new LifecycleError(
      "Hours can't be changed after submission — your supervisor is reviewing them.",
    );
  }
  return timesheet;
}

function validateEntryInput(
  timesheet: { weekStartDate: Date; weekEndDate: Date },
  input: WorkEntryInput,
): string {
  if (Number.isNaN(input.workDate.getTime())) {
    return "Pick the day you worked.";
  }
  const day = input.workDate.getTime();
  if (
    day < timesheet.weekStartDate.getTime() ||
    day > timesheet.weekEndDate.getTime()
  ) {
    return "Pick a day inside this timesheet's week.";
  }
  const shiftProblem = shiftValidationError({
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
  });
  if (shiftProblem) return shiftProblem;
  if (input.note && input.note.length > 500) {
    return "Keep the note under 500 characters.";
  }
  return "";
}

/**
 * Recompute the timesheet total from the CURRENT full set of entries
 * (AC6) — never adjusted incrementally, never client-supplied. The
 * status re-check inside the transaction turns an entry save racing a
 * submission into a clean conflict instead of a silent post-submit edit.
 */
async function applyEntryMutation(
  ctx: AuthContext,
  timesheetId: string,
  mutate: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const guarded = await tx.timesheet.updateMany({
      where: {
        id: timesheetId,
        status: { in: [...PARTICIPANT_EDITABLE_TIMESHEET_STATUSES] },
      },
      data: {},
    });
    if (guarded.count === 0) {
      throw new ConflictError(
        "This timesheet changed while you were working. Refresh to see its latest state.",
      );
    }
    await mutate(tx);
    const entries = await tx.workEntry.findMany({
      where: { timesheetId },
      select: { hours: true },
    });
    await tx.timesheet.update({
      where: { id: timesheetId },
      data: {
        totalHours: totalHoursString(
          entries.map((entry) => entry.hours.toFixed(2)),
        ),
      },
    });
  });
}

/** Add a worked shift (AC1) — hours computed by the 6.3 path, only. */
export async function addWorkEntry(
  ctx: AuthContext,
  timesheetId: string,
  input: WorkEntryInput,
): Promise<void> {
  const timesheet = await loadOwnEditableTimesheet(ctx, timesheetId);
  const problem = validateEntryInput(timesheet, input);
  if (problem) throw new ValidationError(problem);

  const hours = hoursStringFromHundredths(
    shiftHourHundredths({
      startTime: input.startTime,
      endTime: input.endTime,
      breakMinutes: input.breakMinutes,
    }),
  );
  await applyEntryMutation(ctx, timesheetId, async (tx) => {
    await tx.workEntry.create({
      data: {
        timesheetId,
        workDate: input.workDate,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
        hours,
        note: input.note?.trim() ? input.note.trim() : null,
      },
    });
  });
}

/** Edit a shift (AC6): full revalidation, recomputed hours and total. */
export async function updateWorkEntry(
  ctx: AuthContext,
  entryId: string,
  input: WorkEntryInput,
): Promise<void> {
  const entry = await prisma.workEntry.findUnique({
    where: { id: entryId },
    select: { id: true, timesheetId: true },
  });
  if (!entry) throw new NotFoundError();
  const timesheet = await loadOwnEditableTimesheet(ctx, entry.timesheetId);
  const problem = validateEntryInput(timesheet, input);
  if (problem) throw new ValidationError(problem);

  const hours = hoursStringFromHundredths(
    shiftHourHundredths({
      startTime: input.startTime,
      endTime: input.endTime,
      breakMinutes: input.breakMinutes,
    }),
  );
  await applyEntryMutation(ctx, entry.timesheetId, async (tx) => {
    await tx.workEntry.update({
      where: { id: entryId },
      data: {
        workDate: input.workDate,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
        hours,
        note: input.note?.trim() ? input.note.trim() : null,
      },
    });
  });
}

/**
 * Remove a shift from a DRAFT/REJECTED week (AC6). Pre-submission
 * working data: the auditable record is the submitted timesheet, and
 * post-submission entries are immutable through every path (AC2).
 */
export async function removeWorkEntry(ctx: AuthContext, entryId: string): Promise<void> {
  const entry = await prisma.workEntry.findUnique({
    where: { id: entryId },
    select: { id: true, timesheetId: true },
  });
  if (!entry) throw new NotFoundError();
  await loadOwnEditableTimesheet(ctx, entry.timesheetId);

  await applyEntryMutation(ctx, entry.timesheetId, async (tx) => {
    await tx.workEntry.delete({ where: { id: entryId } });
  });
}
