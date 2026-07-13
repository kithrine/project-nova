import {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  PlacementStatus,
} from "@/generated/prisma/client";
import { LifecycleError } from "@/server/errors/app-error";

/**
 * Incident policy (Story 5.11). Categories, severities, and ownership
 * rules come verbatim from docs/ops/incident-response.md — that document
 * is authoritative. The incident's own Open -> Under Review -> Closed
 * machine is independent of placement lifecycle; reporting an incident
 * never transitions the placement, and form submission is documentation,
 * NEVER emergency response (RULES.md).
 */

export const INCIDENT_CATEGORIES = [
  { key: IncidentCategory.SAFETY, label: "Safety" },
  { key: IncidentCategory.INJURY, label: "Injury" },
  { key: IncidentCategory.ANIMAL_WELFARE, label: "Animal welfare" },
  { key: IncidentCategory.ATTENDANCE, label: "Attendance" },
  { key: IncidentCategory.CONDUCT, label: "Conduct" },
  { key: IncidentCategory.PROPERTY, label: "Property" },
  { key: IncidentCategory.HARASSMENT, label: "Harassment" },
  { key: IncidentCategory.OTHER, label: "Other" },
] as const;

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> =
  Object.fromEntries(
    INCIDENT_CATEGORIES.map((category) => [category.key, category.label]),
  ) as Record<IncidentCategory, string>;

export const INCIDENT_SEVERITIES = [
  { key: IncidentSeverity.MINOR, label: "Minor" },
  { key: IncidentSeverity.MODERATE, label: "Moderate" },
  { key: IncidentSeverity.SERIOUS, label: "Serious" },
  { key: IncidentSeverity.EMERGENCY, label: "Emergency" },
] as const;

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> =
  Object.fromEntries(
    INCIDENT_SEVERITIES.map((severity) => [severity.key, severity.label]),
  ) as Record<IncidentSeverity, string>;

/** Serious and Emergency immediately alert Nova Operations (AC2). */
export const URGENT_INCIDENT_SEVERITIES: readonly IncidentSeverity[] = [
  IncidentSeverity.SERIOUS,
  IncidentSeverity.EMERGENCY,
];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  [IncidentStatus.OPEN]: "Open",
  [IncidentStatus.UNDER_REVIEW]: "Under review",
  [IncidentStatus.CLOSED]: "Closed",
};

/**
 * Incidents are reported while work is happening — Onboarding, Active,
 * Paused — and remain reportable after a placement ends ("safety and
 * conduct issues are reported when they happen, including shortly after
 * a placement ends" — no invented cutoff window). Pre-onboarding stages
 * have no site activity to report against.
 */
export const INCIDENT_REPORTABLE_STATUSES: readonly PlacementStatus[] = [
  PlacementStatus.ONBOARDING,
  PlacementStatus.ACTIVE,
  PlacementStatus.PAUSED,
  PlacementStatus.COMPLETED,
  PlacementStatus.CONVERTED_TO_PERMANENT,
  PlacementStatus.WITHDRAWN,
  PlacementStatus.TERMINATED,
];

/** The incident's own status machine — closure is terminal (AC4/AC6). */
export const ALLOWED_INCIDENT_TRANSITIONS: Readonly<
  Record<IncidentStatus, readonly IncidentStatus[]>
> = {
  [IncidentStatus.OPEN]: [IncidentStatus.UNDER_REVIEW, IncidentStatus.CLOSED],
  [IncidentStatus.UNDER_REVIEW]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
};

export function assertIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!ALLOWED_INCIDENT_TRANSITIONS[from].includes(to)) {
    throw new LifecycleError(
      `An incident cannot move from ${INCIDENT_STATUS_LABELS[from].toLowerCase()} to ${INCIDENT_STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

export interface IncidentInput {
  category: string;
  severity: string;
  occurredOn: Date;
  description: string;
  restrictedDetail: string | null;
}

const CATEGORY_KEYS = new Set<string>(Object.values(IncidentCategory));
const SEVERITY_KEYS = new Set<string>(Object.values(IncidentSeverity));

/** Why the incident report cannot be saved, or null when it can (AC1). */
export function incidentValidationError(input: IncidentInput): string | null {
  if (!CATEGORY_KEYS.has(input.category)) {
    return "Choose the incident category.";
  }
  if (!SEVERITY_KEYS.has(input.severity)) {
    return "Choose the incident severity.";
  }
  if (Number.isNaN(input.occurredOn.getTime())) {
    return "Provide the date the incident occurred.";
  }
  if (input.description.trim().length === 0) {
    return "Describe what happened before submitting.";
  }
  if (input.description.length > 4000) {
    return "Keep the description under 4,000 characters.";
  }
  if (input.restrictedDetail !== null && input.restrictedDetail.length > 8000) {
    return "Keep the restricted narrative under 8,000 characters.";
  }
  return null;
}
