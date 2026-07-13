import { PlacementStatus, Role } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  buildPlacementTimeline,
  PLACEMENT_STATUS_LABELS,
  TERMINAL_PLACEMENT_STATUSES,
  type TimelineStage,
} from "@/server/domain/placement";
import { AuthorizationError, NotFoundError } from "@/server/errors/app-error";

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
      organizationSite: {
        select: {
          name: true,
          city: true,
          region: true,
          organization: { select: { name: true } },
        },
      },
      fundingSource: { select: { name: true } },
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
    ...placement.events.map((event) => event.actorUserId),
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
    // Coordinator of record is assigned in 5.2; until then it is absent.
    coordinatorName: null,
    scheduleSummary: placement.schedule,
    startDateLabel: formatDate(placement.startDate),
    endDateLabel: formatDate(placement.endDate),
    fundingSummary: placement.fundingSource
      ? `Candidate: ${placement.fundingSource.name}`
      : null,
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
    })),
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
  };
}
