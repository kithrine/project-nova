import { PlacementStatus } from "@/generated/prisma/client";
import { LifecycleError } from "@/server/errors/app-error";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Placement transitions (docs/product/placement-lifecycle.md), enacted
 * story by story: 5.2 owns Draft -> Proposed -> Shelter Review ->
 * Approved plus the change-request return to Draft (the placement
 * lifecycle has no Change Requested state — the loop reuses Draft); 5.4
 * enters Onboarding; 5.6 activates; 5.7 runs the Active ⇄ Paused loop;
 * 5.8 owns the four terminal outcomes. Terminal states transition
 * nowhere, ever.
 */
export const ALLOWED_PLACEMENT_TRANSITIONS: Readonly<
  Record<PlacementStatus, readonly PlacementStatus[]>
> = {
  [PlacementStatus.DRAFT]: [PlacementStatus.PROPOSED],
  [PlacementStatus.PROPOSED]: [PlacementStatus.SHELTER_REVIEW],
  [PlacementStatus.SHELTER_REVIEW]: [PlacementStatus.APPROVED, PlacementStatus.DRAFT],
  [PlacementStatus.APPROVED]: [PlacementStatus.ONBOARDING],
  [PlacementStatus.ONBOARDING]: [PlacementStatus.ACTIVE],
  [PlacementStatus.ACTIVE]: [
    PlacementStatus.PAUSED,
    PlacementStatus.COMPLETED,
    PlacementStatus.CONVERTED_TO_PERMANENT,
    PlacementStatus.WITHDRAWN,
    PlacementStatus.TERMINATED,
  ],
  [PlacementStatus.PAUSED]: [
    PlacementStatus.ACTIVE,
    PlacementStatus.COMPLETED,
    PlacementStatus.CONVERTED_TO_PERMANENT,
    PlacementStatus.WITHDRAWN,
    PlacementStatus.TERMINATED,
  ],
  [PlacementStatus.COMPLETED]: [],
  [PlacementStatus.CONVERTED_TO_PERMANENT]: [],
  [PlacementStatus.WITHDRAWN]: [],
  [PlacementStatus.TERMINATED]: [],
};

export function assertPlacementTransition(
  from: PlacementStatus,
  to: PlacementStatus,
): void {
  if (!ALLOWED_PLACEMENT_TRANSITIONS[from].includes(to)) {
    throw new LifecycleError(
      `A placement cannot move from ${PLACEMENT_STATUS_LABELS[from].toLowerCase()} to ${PLACEMENT_STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

/**
 * What the review package still needs before the coordinator can propose
 * it to the shelter (Story 5.2 AC3) — each missing piece is NAMED. Site
 * is structurally present on every placement; the rest are assigned here.
 */
export function packageMissingPieces(placement: {
  supervisorId: string | null;
  coordinatorUserId: string | null;
  hasStructuredSchedule: boolean;
}): string[] {
  const missing: string[] = [];
  if (!placement.supervisorId) missing.push("Supervisor");
  if (!placement.coordinatorUserId) missing.push("Coordinator of record");
  if (!placement.hasStructuredSchedule) missing.push("Work schedule");
  return missing;
}

/**
 * The placement-onboarding task catalog (Story 5.4; ADR-017 Layer 2) —
 * site-specific preparation, generated when onboarding is initiated and
 * never auto-completed by portable Story 3.4 training. Fixed code catalog
 * for MVP (the 3.2 template table is program-scoped portable content;
 * this layer is the same for every site until site-specific authoring
 * exists). participantCompletable=false rows are verified by the shelter
 * or the coordinator.
 */
export const PLACEMENT_ONBOARDING_CATALOG = [
  {
    title: "Site safety and hazard orientation delivered",
    description:
      "The host walked the participant through this site's hazards, emergency exits, and procedures.",
    required: true,
    participantCompletable: false,
    sortOrder: 1,
  },
  {
    title: "Chemicals, cleaning products, and PPE instruction delivered",
    description:
      "Site-specific instruction on the products in use, safety data sheets, and required protective equipment.",
    required: true,
    participantCompletable: false,
    sortOrder: 2,
  },
  {
    title: "Local sanitation procedures walkthrough delivered",
    description: "This site's cleaning and disinfection routines and equipment.",
    required: true,
    participantCompletable: false,
    sortOrder: 3,
  },
  {
    title: "Assigned-task restrictions reviewed with the supervisor",
    description:
      "What tasks are and are not part of this placement, reviewed together.",
    required: true,
    participantCompletable: false,
    sortOrder: 4,
  },
  {
    title: "Supervisor-observed task competency confirmed",
    description:
      "The supervisor watched the assigned tasks done safely before independent work.",
    required: true,
    participantCompletable: false,
    sortOrder: 5,
  },
  {
    title: "Acknowledge the site safety procedures",
    description: "Confirm you've received and understood this site's safety walkthrough.",
    required: true,
    participantCompletable: true,
    sortOrder: 6,
  },
  {
    title: "Sign the confidentiality and workplace conduct agreement",
    description: "The agreement covering animals, adopters, and workplace conduct.",
    required: true,
    participantCompletable: true,
    sortOrder: 7,
  },
  {
    title: "Confirm you received your PPE and uniform",
    description: "Gloves, any site-required gear, and your uniform items.",
    required: true,
    participantCompletable: true,
    sortOrder: 8,
  },
] as const;

/**
 * Pause reason categories (Story 5.7). A pause always carries a reason;
 * the category keeps it structured while the optional note carries the
 * specifics. The composed record rides the lifecycle event's ops-internal
 * detail — medical and personal circumstances are the participant's
 * business and Nova's, never surfaced to shelter viewers (the Paused
 * STATUS itself is visible everywhere).
 */
export const PAUSE_REASON_CATEGORIES = [
  { key: "MEDICAL_LEAVE", label: "Medical leave" },
  { key: "SHELTER_CLOSURE", label: "Shelter closure or site disruption" },
  { key: "PERSONAL", label: "Personal circumstances" },
  { key: "OTHER", label: "Other" },
] as const;

export type PauseReasonKey = (typeof PAUSE_REASON_CATEGORIES)[number]["key"];

export function pauseReasonLabel(key: string): string | null {
  return (
    PAUSE_REASON_CATEGORIES.find((category) => category.key === key)?.label ?? null
  );
}

/** The pause cycle's ops-internal event record (Story 5.7 AC1/AC3). */
export function pauseEventDetail(input: {
  reasonLabel: string;
  effectiveDateLabel: string;
  note: string | null;
}): string {
  const base = `Paused (${input.reasonLabel}) effective ${input.effectiveDateLabel}`;
  return input.note ? `${base} — ${input.note}` : base;
}

/** The resume record (Story 5.7 AC2). */
export function resumeEventDetail(input: { effectiveDateLabel: string }): string {
  return `Resumed effective ${input.effectiveDateLabel}`;
}

/**
 * Termination reason categories (Story 5.8; ADR-018). Ops-internal like
 * the pause categories — the reason rides the lifecycle event's detail,
 * never shelter or participant views; the terminal STATUS itself is
 * visible everywhere.
 */
export const TERMINATION_REASON_CATEGORIES = [
  { key: "SAFETY_CONCERN", label: "Safety concern" },
  { key: "CONDUCT_POLICY_VIOLATION", label: "Conduct or policy violation" },
  { key: "SUSTAINED_NON_ATTENDANCE", label: "Sustained non-attendance" },
  { key: "OTHER", label: "Other" },
] as const;

export function terminationReasonLabel(key: string): string | null {
  return (
    TERMINATION_REASON_CATEGORIES.find((category) => category.key === key)?.label ??
    null
  );
}

/**
 * The four terminal outcomes (Story 5.8): each is its own clearly
 * labeled action — never a generic status dropdown (RULES.md) — split
 * across two permissions per ADR-018. The transition table above
 * already admits each from Active and Paused only.
 */
export const TERMINAL_OUTCOMES = [
  { status: PlacementStatus.COMPLETED, permission: "placement.complete" },
  { status: PlacementStatus.CONVERTED_TO_PERMANENT, permission: "placement.complete" },
  { status: PlacementStatus.WITHDRAWN, permission: "placement.complete" },
  { status: PlacementStatus.TERMINATED, permission: "placement.terminate" },
] as const;

/** Ops-internal event records for the four endings (Story 5.8 AC6). */
export function terminalEventDetail(input: {
  status: PlacementStatus;
  effectiveDateLabel: string;
  /** Terminated: the ADR-018 reason label. Others: none. */
  reasonLabel?: string;
  /** Withdrawn: the participant's stated reason. Others: optional note. */
  note?: string | null;
  /** Converted: who hired them. */
  employerName?: string;
}): string {
  const base =
    input.status === PlacementStatus.CONVERTED_TO_PERMANENT
      ? `Converted to permanent employment — hired by ${input.employerName} effective ${input.effectiveDateLabel}`
      : input.status === PlacementStatus.TERMINATED
        ? `Terminated (${input.reasonLabel}) effective ${input.effectiveDateLabel}`
        : `${PLACEMENT_STATUS_LABELS[input.status]} effective ${input.effectiveDateLabel}`;
  return input.note ? `${base} — ${input.note}` : base;
}

export interface ScheduleDayInput {
  day: string;
  startTime: string;
  endTime: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Positive, at most two decimals, at most 80 — Decimal-safe by shape. */
const HOURS_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;

/**
 * Why a schedule cannot be saved, or null when it can (Story 5.2).
 * Weekly hours arrive as a STRING and stay decimal-shaped end to end —
 * floating point never touches them (RULES.md).
 */
export function scheduleValidationError(input: {
  days: ScheduleDayInput[];
  weeklyHoursTarget: string;
}): string | null {
  if (input.days.length === 0) {
    return "Pick at least one working day.";
  }
  const seen = new Set<string>();
  for (const entry of input.days) {
    if (seen.has(entry.day)) {
      return "Each day can appear only once in the schedule.";
    }
    seen.add(entry.day);
    if (!TIME_PATTERN.test(entry.startTime) || !TIME_PATTERN.test(entry.endTime)) {
      return "Times must be in 24-hour HH:MM form.";
    }
    if (entry.endTime <= entry.startTime) {
      return "Each working day must end after it starts.";
    }
  }
  if (!HOURS_PATTERN.test(input.weeklyHoursTarget)) {
    return "Weekly hours must be a number like 20 or 20.5 (up to two decimals).";
  }
  const hours = Number(input.weeklyHoursTarget);
  if (hours <= 0 || hours > 80) {
    return "Weekly hours must be between 0 and 80.";
  }
  return null;
}

export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  [PlacementStatus.DRAFT]: "Draft",
  [PlacementStatus.PROPOSED]: "Proposed",
  [PlacementStatus.SHELTER_REVIEW]: "Shelter review",
  [PlacementStatus.APPROVED]: "Approved",
  [PlacementStatus.ONBOARDING]: "Onboarding",
  [PlacementStatus.ACTIVE]: "Active",
  [PlacementStatus.PAUSED]: "Paused",
  [PlacementStatus.COMPLETED]: "Completed",
  [PlacementStatus.CONVERTED_TO_PERMANENT]: "Converted to permanent employment",
  [PlacementStatus.WITHDRAWN]: "Withdrawn",
  [PlacementStatus.TERMINATED]: "Terminated",
};

/**
 * Badge tones for placement statuses (uniform vocabulary,
 * docs/ux/component-guidelines.md): in-flight review phases info, working
 * states and good endings success, Paused warning (needs attention to
 * resume), Terminated the one adverse ending. Withdrawn is a closed
 * neutral — a decision, not a failure.
 */
export const PLACEMENT_STATUS_TONES: Record<PlacementStatus, BadgeTone> = {
  [PlacementStatus.DRAFT]: "neutral",
  [PlacementStatus.PROPOSED]: "info",
  [PlacementStatus.SHELTER_REVIEW]: "info",
  [PlacementStatus.APPROVED]: "success",
  [PlacementStatus.ONBOARDING]: "info",
  [PlacementStatus.ACTIVE]: "success",
  [PlacementStatus.PAUSED]: "warning",
  [PlacementStatus.COMPLETED]: "success",
  [PlacementStatus.CONVERTED_TO_PERMANENT]: "success",
  [PlacementStatus.WITHDRAWN]: "neutral",
  [PlacementStatus.TERMINATED]: "error",
};

/** The main path a placement walks (docs/product/placement-lifecycle.md). */
const MAIN_PATH: readonly PlacementStatus[] = [
  PlacementStatus.DRAFT,
  PlacementStatus.PROPOSED,
  PlacementStatus.SHELTER_REVIEW,
  PlacementStatus.APPROVED,
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
];

export const TERMINAL_PLACEMENT_STATUSES = [
  PlacementStatus.COMPLETED,
  PlacementStatus.CONVERTED_TO_PERMANENT,
  PlacementStatus.WITHDRAWN,
  PlacementStatus.TERMINATED,
] as const;

export interface TimelineStage {
  status: PlacementStatus;
  label: string;
  state: "past" | "current" | "upcoming";
}

/**
 * The Lifecycle Timeline (Story 5.1): every documented stage with the
 * current one indicated. Paused renders as the current stage alongside
 * Active's position (the Active ⇄ Paused loop); a terminal status closes
 * the timeline with itself as the final, current entry — terminal
 * placements are never reopened, so nothing renders as upcoming after
 * them. For terminal placements, lastNonTerminalStatus (from the event
 * trail) bounds how far along the main path renders as reached — a
 * placement withdrawn during Shelter Review never shows Active as past.
 */
export function buildPlacementTimeline(
  status: PlacementStatus,
  lastNonTerminalStatus?: PlacementStatus,
): TimelineStage[] {
  const isTerminal = (TERMINAL_PLACEMENT_STATUSES as readonly PlacementStatus[]).includes(
    status,
  );
  const isPaused = status === PlacementStatus.PAUSED;

  // How far along the main path this placement actually progressed.
  const reached =
    isTerminal && lastNonTerminalStatus
      ? MAIN_PATH.indexOf(
          lastNonTerminalStatus === PlacementStatus.PAUSED
            ? PlacementStatus.ACTIVE
            : lastNonTerminalStatus,
        ) + 1
      : MAIN_PATH.length;

  let stages: TimelineStage[];
  if (isTerminal || isPaused) {
    // No main-path stage is current: Paused/terminal entries append below.
    stages = MAIN_PATH.map((stage, index) => ({
      status: stage,
      label: PLACEMENT_STATUS_LABELS[stage],
      state: index < reached ? "past" : "upcoming",
    }));
  } else {
    const currentIndex = MAIN_PATH.indexOf(status);
    stages = MAIN_PATH.map((stage, index) => ({
      status: stage,
      label: PLACEMENT_STATUS_LABELS[stage],
      state:
        index < currentIndex ? "past" : index === currentIndex ? "current" : "upcoming",
    }));
  }

  if (isPaused) {
    stages.push({
      status: PlacementStatus.PAUSED,
      label: PLACEMENT_STATUS_LABELS[PlacementStatus.PAUSED],
      state: "current",
    });
  }

  if (isTerminal) {
    stages.push({
      status,
      label: PLACEMENT_STATUS_LABELS[status],
      state: "current",
    });
  }

  return stages;
}

/**
 * Placement lifecycle constants (Story 4.8 creates placements; Epic 5
 * owns the transitions — the full table arrives with Story 5.2).
 */

/**
 * Any placement in these statuses occupies the participant's pipeline:
 * it excludes them from the matching queue and blocks new match drafts
 * and approvals. Terminal statuses (Completed, Converted to Permanent
 * Employment, Withdrawn, Terminated) free the pipeline again.
 */
export const NON_TERMINAL_PLACEMENT_STATUSES = [
  PlacementStatus.DRAFT,
  PlacementStatus.PROPOSED,
  PlacementStatus.SHELTER_REVIEW,
  PlacementStatus.APPROVED,
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
] as const;

/**
 * The active tier the "one active placement per participant" partial
 * unique index enforces at the database (database-design.md;
 * business-rules.md) — the hard backstop behind application-level checks.
 */
export const ACTIVE_PLACEMENT_STATUSES = [
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
] as const;
