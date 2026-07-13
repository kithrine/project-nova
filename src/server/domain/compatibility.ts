/**
 * The compatibility evaluator (Story 4.2; docs/product/compatibility-engine.md,
 * ADR-011). Coordinator decision support, never a decision-maker: every
 * factor produces a plain-language explanation, the overall read is one of
 * exactly FOUR categories, and no numeric score exists anywhere. When a
 * required input cannot be determined, the answer is "Unknown / needs
 * review" — never a guess. An approved placement restriction surfaces as a
 * factor WITHOUT its narrative; the underlying content stays behind
 * restricted permission, outside this panel.
 */

export type FactorStatus = "CLEAR" | "CONCERN" | "BLOCKING" | "UNKNOWN";

export type CompatibilityCategory =
  | "COMPATIBLE"
  | "POTENTIAL_CONCERN"
  | "BLOCKING_INCOMPATIBILITY"
  | "UNKNOWN_NEEDS_REVIEW";

export const COMPATIBILITY_CATEGORY_LABELS: Record<CompatibilityCategory, string> = {
  COMPATIBLE: "Compatible",
  POTENTIAL_CONCERN: "Potential concern",
  BLOCKING_INCOMPATIBILITY: "Blocking incompatibility",
  UNKNOWN_NEEDS_REVIEW: "Unknown / needs review",
};

export const FACTOR_STATUS_LABELS: Record<FactorStatus, string> = {
  CLEAR: "Clear",
  CONCERN: "Concern",
  BLOCKING: "Blocking",
  UNKNOWN: "Unknown",
};

export interface CompatibilityFactor {
  key: string;
  label: string;
  status: FactorStatus;
  detail: string;
}

export interface CompatibilityInputs {
  /** The participant's own availability words; null = not recorded. */
  availabilityNotes: string | null;
  /** The participant's own transportation words; null = not recorded. */
  transportationNotes: string | null;
  requiredTrainingTotal: number;
  requiredTrainingCompleted: number;
  /** Required-marked certifications with their current satisfaction (3.5 rules). */
  requiredCertifications: readonly { name: string; satisfied: boolean }[];
  siteCapacity: number;
  /** ACTIVE shelter-supervisor memberships at the host organization. */
  supervisorCount: number;
  /** Draft-stage details; null before a draft exists (4.3). */
  proposedSchedule: string | null;
  proposedStartDate: Date | null;
  proposedEndDate: Date | null;
  /** An approved placement restriction applies (content stays restricted). */
  hasApprovedRestriction: boolean;
}

export interface CompatibilityResult {
  category: CompatibilityCategory;
  categoryLabel: string;
  factors: CompatibilityFactor[];
}

const RESTRICTION_DETAIL =
  "An approved placement restriction applies to this participant. Review it before proposing — the underlying detail stays restricted and is never shown here or to shelters.";

export function evaluateCompatibility(
  inputs: CompatibilityInputs,
  now: Date = new Date(),
): CompatibilityResult {
  const factors: CompatibilityFactor[] = [];

  factors.push(
    inputs.availabilityNotes
      ? {
          key: "availability",
          label: "Participant availability",
          status: "CLEAR",
          detail: `On file: "${inputs.availabilityNotes}"`,
        }
      : {
          key: "availability",
          label: "Participant availability",
          status: "UNKNOWN",
          detail: "No availability recorded on the application.",
        },
  );

  if (inputs.requiredCertifications.length === 0) {
    factors.push({
      key: "certifications",
      label: "Required certifications",
      status: "CLEAR",
      detail: "No certifications are marked required for this participant.",
    });
  } else {
    const unsatisfied = inputs.requiredCertifications.filter((c) => !c.satisfied);
    factors.push(
      unsatisfied.length === 0
        ? {
            key: "certifications",
            label: "Required certifications",
            status: "CLEAR",
            detail: "Certifications: complete and unexpired.",
          }
        : {
            key: "certifications",
            label: "Required certifications",
            status: "BLOCKING",
            detail: `Missing or expired: ${unsatisfied.map((c) => c.name).join("; ")}.`,
          },
    );
  }

  factors.push(
    inputs.requiredTrainingTotal === 0
      ? {
          key: "training",
          label: "Training completion",
          status: "CLEAR",
          detail: "No required training is configured for this program.",
        }
      : inputs.requiredTrainingCompleted >= inputs.requiredTrainingTotal
        ? {
            key: "training",
            label: "Training completion",
            status: "CLEAR",
            detail: `Training: ${inputs.requiredTrainingCompleted} of ${inputs.requiredTrainingTotal} required programs complete.`,
          }
        : {
            key: "training",
            label: "Training completion",
            status: "BLOCKING",
            detail: `Training incomplete: ${inputs.requiredTrainingCompleted} of ${inputs.requiredTrainingTotal} required programs complete.`,
          },
  );

  factors.push(
    inputs.siteCapacity > 0
      ? {
          key: "capacity",
          label: "Shelter capacity",
          status: "CLEAR",
          detail: `Site capacity available (${inputs.siteCapacity}).`,
        }
      : {
          key: "capacity",
          label: "Shelter capacity",
          status: "BLOCKING",
          detail: "This site has no available capacity.",
        },
  );

  factors.push(
    inputs.supervisorCount > 0
      ? {
          key: "supervision",
          label: "Site and supervisor availability",
          status: "CLEAR",
          detail: `${inputs.supervisorCount} active supervisor${inputs.supervisorCount === 1 ? "" : "s"} at this shelter.`,
        }
      : {
          key: "supervision",
          label: "Site and supervisor availability",
          status: "BLOCKING",
          detail: "No active supervisors at this shelter — daily supervision is required.",
        },
  );

  factors.push(
    inputs.proposedSchedule
      ? {
          key: "schedule",
          label: "Proposed schedule",
          status: "CLEAR",
          detail: `Proposed: ${inputs.proposedSchedule}`,
        }
      : {
          key: "schedule",
          label: "Proposed schedule",
          status: "UNKNOWN",
          detail: "Not yet proposed — set on the match draft (4.3).",
        },
  );

  factors.push(
    inputs.transportationNotes
      ? {
          key: "transportation",
          label: "Transportation feasibility",
          status: "CLEAR",
          detail: `On file: "${inputs.transportationNotes}"`,
        }
      : {
          key: "transportation",
          label: "Transportation feasibility",
          status: "UNKNOWN",
          detail: "No transportation information recorded on the application.",
        },
  );

  if (!inputs.proposedStartDate && !inputs.proposedEndDate) {
    factors.push({
      key: "dates",
      label: "Placement dates",
      status: "UNKNOWN",
      detail: "Not yet proposed — set on the match draft (4.3).",
    });
  } else if (
    inputs.proposedStartDate &&
    inputs.proposedEndDate &&
    inputs.proposedEndDate.getTime() < inputs.proposedStartDate.getTime()
  ) {
    factors.push({
      key: "dates",
      label: "Placement dates",
      status: "BLOCKING",
      detail: "The proposed end date is before the start date.",
    });
  } else if (
    inputs.proposedStartDate &&
    inputs.proposedStartDate.getTime() < now.getTime() - 86_400_000
  ) {
    factors.push({
      key: "dates",
      label: "Placement dates",
      status: "CONCERN",
      detail: "The proposed start date has already passed.",
    });
  } else {
    factors.push({
      key: "dates",
      label: "Placement dates",
      status: "CLEAR",
      detail: "Proposed dates are coherent.",
    });
  }

  if (inputs.hasApprovedRestriction) {
    factors.push({
      key: "restriction",
      label: "Placement restriction",
      status: "CONCERN",
      detail: RESTRICTION_DETAIL,
    });
  }

  return {
    category: overallCategory(factors),
    categoryLabel: COMPATIBILITY_CATEGORY_LABELS[overallCategory(factors)],
    factors,
  };
}

/** Worst-of ordering: blocking > unknown > concern > clear (AC1–AC4). */
function overallCategory(factors: readonly CompatibilityFactor[]): CompatibilityCategory {
  if (factors.some((f) => f.status === "BLOCKING")) return "BLOCKING_INCOMPATIBILITY";
  if (factors.some((f) => f.status === "UNKNOWN")) return "UNKNOWN_NEEDS_REVIEW";
  if (factors.some((f) => f.status === "CONCERN")) return "POTENTIAL_CONCERN";
  return "COMPATIBLE";
}
