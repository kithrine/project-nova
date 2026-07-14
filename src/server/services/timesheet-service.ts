import { PlacementStatus, Prisma, TimesheetStatus } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  isoDate,
  mondayOfWeek,
  nextWeek,
  PARTICIPANT_EDITABLE_TIMESHEET_STATUSES,
  parseWeekParam,
  previousWeek,
  TIMESHEET_STATUS_LABELS,
  weekCreationBlockReason,
  weekEndFor,
  weekLabel,
} from "@/server/domain/timesheet";
import { AuthorizationError } from "@/server/errors/app-error";

/**
 * TimesheetService (Epic 6; api-service-design.md). Story 6.1 owns the
 * idempotent weekly get-or-create for the participant's OWN placement:
 * every operation resolves ownership server-side through the Person ->
 * Participant chain — a client-supplied placement or participant id is
 * never part of the contract (AC6). Weeks are Monday-Sunday; at most one
 * timesheet per placement per week, backed by the unique constraint.
 */

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

  return {
    week: {
      ...base,
      timesheetId: timesheet.id,
      statusKey: timesheet.status,
      statusLabel: TIMESHEET_STATUS_LABELS[timesheet.status],
      totalHours: timesheet.totalHours.toFixed(2),
      editable: PARTICIPANT_EDITABLE_TIMESHEET_STATUSES.includes(timesheet.status),
      blockedReason: null,
    },
    siteName: placement.organizationSite.name,
    organizationName: placement.organizationSite.organization.name,
  };
}
