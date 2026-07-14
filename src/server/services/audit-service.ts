import { requireNovaScope, requirePermission } from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import { parseOptionalReportRange } from "@/server/domain/reporting";

/**
 * Audit events (Story 2.7; docs/architecture/security-privacy.md). Records
 * WHO accessed or performed something sensitive, distinct from lifecycle
 * events, which record what happened to a workflow record (architecture.md).
 * Append-only; the record itself carries no sensitive content — only the
 * action code and the subject reference, so the trail is safe to review.
 *
 * This module deliberately exposes NO update or delete path: audit
 * events are written (here or in-transaction by the owning service) and
 * read (Story 7.6) — nothing else. The 7.6 integration tests assert that
 * shape.
 */
export async function recordAuditEvent(
  ctx: AuthContext,
  action: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await prisma.auditEvent.create({
    data: { actorUserId: ctx.userId, action, subjectType, subjectId },
  });
}

// --- Audit review (Story 7.6) --------------------------------------------------

/** The review surface never pages unboundedly; newest events first. */
export const AUDIT_REVIEW_LIMIT = 100;

export interface AuditReviewFilters {
  actorUserId?: string;
  action?: string;
  subjectType?: string;
  from?: string;
  to?: string;
}

export interface AuditReviewRow {
  id: string;
  actorName: string;
  action: string;
  subjectType: string;
  /** A reference only — never the record's contents (AC4). */
  subjectId: string;
  detail: string | null;
  atIso: string;
  atLabel: string;
}

export interface AuditReviewView {
  rows: AuditReviewRow[];
  /** Total matches for the filters; rows holds at most AUDIT_REVIEW_LIMIT. */
  totalCount: number;
  actorOptions: Array<{ value: string; label: string }>;
  actionOptions: string[];
  subjectTypeOptions: string[];
  applied: {
    actorUserId: string | null;
    action: string | null;
    subjectType: string | null;
    fromIso: string | null;
    toIso: string | null;
  };
}

function formatAuditTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Audit review (Story 7.6): the privileged read over the append-only
 * audit trail — sensitive-data access, exports, and restricted actions,
 * filterable by actor, action, resource type, and date. Requires
 * `audit.view` plus Nova scope; the rows carry action codes, subject
 * references, and the deliberately non-sensitive detail line — never
 * restricted record contents (that is a write-side invariant from 2.7).
 * Filter options are built from the events themselves, so the form only
 * offers values that exist.
 */
export async function listAuditEvents(
  ctx: AuthContext,
  filters: AuditReviewFilters = {},
): Promise<AuditReviewView> {
  requirePermission(ctx, "audit.view");
  requireNovaScope(ctx);

  const range = parseOptionalReportRange(filters);
  const applied = {
    actorUserId: filters.actorUserId || null,
    action: filters.action || null,
    subjectType: filters.subjectType || null,
    fromIso: range?.fromIso ?? null,
    toIso: range?.toIso ?? null,
  };

  const where = {
    ...(applied.actorUserId ? { actorUserId: applied.actorUserId } : {}),
    ...(applied.action ? { action: applied.action } : {}),
    ...(applied.subjectType ? { subjectType: applied.subjectType } : {}),
    ...(range
      ? {
          createdAt: {
            gte: new Date(`${range.fromIso}T00:00:00.000Z`),
            // Inclusive end date: strictly before the following midnight.
            lt: new Date(
              new Date(`${range.toIso}T00:00:00.000Z`).getTime() + 86_400_000,
            ),
          },
        }
      : {}),
  };

  const [events, totalCount, actionGroups, subjectTypeGroups, actorGroups] =
    await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: AUDIT_REVIEW_LIMIT,
      }),
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
      prisma.auditEvent.groupBy({
        by: ["subjectType"],
        orderBy: { subjectType: "asc" },
      }),
      prisma.auditEvent.groupBy({ by: ["actorUserId"] }),
    ]);

  const actorIds = new Set<string>(actorGroups.map((group) => group.actorUserId));
  for (const event of events) actorIds.add(event.actorUserId);
  const actors = actorIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...actorIds] } },
        select: { id: true, displayName: true },
      })
    : [];
  const nameById = new Map(actors.map((user) => [user.id, user.displayName]));

  return {
    rows: events.map((event) => ({
      id: event.id,
      actorName: nameById.get(event.actorUserId) ?? "Former user",
      action: event.action,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      detail: event.detail,
      atIso: event.createdAt.toISOString(),
      atLabel: formatAuditTimestamp(event.createdAt),
    })),
    totalCount,
    actorOptions: [...nameById.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    actionOptions: actionGroups.map((group) => group.action),
    subjectTypeOptions: subjectTypeGroups.map((group) => group.subjectType),
    applied,
  };
}
