/**
 * Decision reason categories (Story 2.11; ADR-016). Pure and client-safe —
 * shared by the Decision Panel, the Server Actions' validation, and the
 * decision service. The category alone determines the terminal status:
 * ONLY the three disqualification categories may set DISQUALIFIED.
 */

/** Ordinary rejection — reapplication allowed 30 days after the decision. */
export const ORDINARY_REJECTION_CATEGORIES = {
  ELIGIBILITY: "Eligibility — program criteria not met",
  INTERVIEW: "Interview — not advanced",
  BACKGROUND: "Background — not cleared",
  OTHER: "Other program reason",
} as const;

/**
 * Permanent disqualification (ADR-016): an unmitigable legal nexus or
 * conduct against the program itself. A time-limited possession ban is an
 * ordinary rejection, not one of these.
 */
export const DISQUALIFICATION_CATEGORIES = {
  PERMANENT_POSSESSION_BAN:
    "Active permanent court-ordered animal-possession ban (RCW 16.52.200)",
  PROGRAM_VIOLENCE: "Violence or credible threats within the program",
  PROGRAM_FRAUD: "Fraud against the program, including application falsification",
} as const;

export type OrdinaryRejectionCategory = keyof typeof ORDINARY_REJECTION_CATEGORIES;
export type DisqualificationCategory = keyof typeof DISQUALIFICATION_CATEGORIES;
export type DecisionCategory = OrdinaryRejectionCategory | DisqualificationCategory;

export function isDisqualifyingCategory(
  category: DecisionCategory,
): category is DisqualificationCategory {
  return category in DISQUALIFICATION_CATEGORIES;
}

export function isDecisionCategory(value: string): value is DecisionCategory {
  return value in ORDINARY_REJECTION_CATEGORIES || value in DISQUALIFICATION_CATEGORIES;
}
