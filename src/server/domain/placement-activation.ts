import {
  ParticipantMatchDecision,
  PlacementStatus,
  ShelterMatchDecision,
  EnrollmentStatus,
} from "@/generated/prisma/client";

/**
 * The activation-prerequisite policy (Story 5.5) — the single computation
 * behind the workspace Blocker List, the Operations dashboard's urgent
 * surface, and the 5.6 activation gate, mirroring the 3.6
 * matching-readiness pattern: what is DISPLAYED and what is ENFORCED can
 * never drift apart. Pure and read-only — callers load live state and
 * evaluate on demand; nothing here is cached or stored.
 *
 * The prerequisite list in docs/product/placement-lifecycle.md is
 * authoritative and matched item for item — eleven entries since ADR-017
 * split onboarding into its portable (Layer 1) and site-specific
 * (Layer 2) halves. Titles below are the doc's names verbatim (AC1).
 */

export type ActivationPrerequisiteKey =
  | "validEnrollment"
  | "participantAccepted"
  | "shelterApproved"
  | "hostAndSite"
  | "supervisorAndCoordinator"
  | "enrollmentOnboarding"
  | "portableTraining"
  | "siteOnboarding"
  | "schedule"
  | "funding"
  | "noConflict";

/** Live state the service layer loads for one placement. */
export interface ActivationSnapshot {
  status: PlacementStatus;
  enrollmentStatus: EnrollmentStatus;
  participantDecision: ParticipantMatchDecision;
  shelterDecision: ShelterMatchDecision;
  hostOrganizationAssigned: boolean;
  siteAssigned: boolean;
  supervisorAssigned: boolean;
  coordinatorAssigned: boolean;
  /**
   * Outstanding counts per the 3.6 readiness policy
   * (computeMatchingReadiness) — the SAME semantics that gated Ready for
   * Matching, so a certification never recorded is not a blocker here
   * either, and an archived one no longer demands renewal.
   */
  enrollmentTasksOutstanding: number;
  trainingOutstanding: number;
  certificationsOutstanding: number;
  /** Site-specific tasks exist (5.4 generates them at initiation). */
  siteTasksGenerated: boolean;
  siteTasksOutstanding: number;
  scheduleAssigned: boolean;
  fundingActive: boolean;
  /** Another placement of this participant in the active tier, if any. */
  conflictingPlacementNumber: string | null;
}

export interface ActivationPrerequisite {
  key: ActivationPrerequisiteKey;
  /** Named exactly as docs/product/placement-lifecycle.md lists it (AC1). */
  title: string;
  met: boolean;
  /** The plain-language next step while unmet — never an internal code. */
  action: string;
}

/**
 * Blockers apply while the placement is pre-Active — Draft through
 * Onboarding (AC6). Active, Paused, and terminal placements are past the
 * gate; the list never renders for them.
 */
export function activationBlocksApply(status: PlacementStatus): boolean {
  return (
    status === PlacementStatus.DRAFT ||
    status === PlacementStatus.PROPOSED ||
    status === PlacementStatus.SHELTER_REVIEW ||
    status === PlacementStatus.APPROVED ||
    status === PlacementStatus.ONBOARDING
  );
}

/**
 * Evaluate all eleven prerequisites in the doc's order. "Schedule
 * confirmed" needs both the structured schedule AND the shelter's package
 * approval — a schedule revised after a change request is assigned but
 * not yet confirmed until the package passes Shelter Review again.
 */
export function evaluateActivationPrerequisites(
  snapshot: ActivationSnapshot,
): ActivationPrerequisite[] {
  const packageConfirmed =
    snapshot.status !== PlacementStatus.DRAFT &&
    snapshot.status !== PlacementStatus.PROPOSED &&
    snapshot.status !== PlacementStatus.SHELTER_REVIEW;

  return [
    {
      key: "validEnrollment",
      title: "Valid enrollment",
      met: snapshot.enrollmentStatus === EnrollmentStatus.READY_FOR_MATCHING,
      action: "Confirm the program enrollment is in good standing.",
    },
    {
      key: "participantAccepted",
      title: "Participant accepted",
      met: snapshot.participantDecision === ParticipantMatchDecision.ACCEPTED,
      action: "Record the participant's acceptance on the source match.",
    },
    {
      key: "shelterApproved",
      title: "Shelter approved",
      met: snapshot.shelterDecision === ShelterMatchDecision.APPROVED,
      action: "Record the shelter's approval on the source match.",
    },
    {
      key: "hostAndSite",
      title: "Host and site assigned",
      met: snapshot.hostOrganizationAssigned && snapshot.siteAssigned,
      action: "Assign the host organization and site.",
    },
    {
      key: "supervisorAndCoordinator",
      title: "Supervisor and coordinator assigned",
      met: snapshot.supervisorAssigned && snapshot.coordinatorAssigned,
      action: "Assign the supervisor and the coordinator of record.",
    },
    {
      key: "enrollmentOnboarding",
      title: "Onboarding complete",
      met: snapshot.enrollmentTasksOutstanding === 0,
      action: "Complete the remaining program onboarding tasks.",
    },
    {
      key: "portableTraining",
      title: "Portable training and required certifications complete",
      met: snapshot.trainingOutstanding === 0 && snapshot.certificationsOutstanding === 0,
      action: "Complete required training and renew any expired certification.",
    },
    {
      key: "siteOnboarding",
      title: "Host-site safety orientation and assigned-task competency confirmed",
      met: snapshot.siteTasksGenerated && snapshot.siteTasksOutstanding === 0,
      action: snapshot.siteTasksGenerated
        ? "Complete the remaining site onboarding steps."
        : "Start placement onboarding to generate this site's checklist.",
    },
    {
      key: "schedule",
      title: "Schedule confirmed",
      met: snapshot.scheduleAssigned && packageConfirmed,
      action: snapshot.scheduleAssigned
        ? "Propose the package so the shelter can confirm the schedule."
        : "Build the work schedule and propose the package to the shelter.",
    },
    {
      key: "funding",
      title: "Active funding assignment",
      met: snapshot.fundingActive,
      action: "Assign a funding source.",
    },
    {
      key: "noConflict",
      title: "No conflicting active placement",
      met: snapshot.conflictingPlacementNumber === null,
      action: snapshot.conflictingPlacementNumber
        ? `Resolve placement ${snapshot.conflictingPlacementNumber} first — a participant holds one onboarding, active, or paused placement at a time.`
        : "Resolve the participant's other active placement first.",
    },
  ];
}

/** The unmet prerequisites — what the Blocker List renders (AC1). */
export function openActivationBlockers(
  snapshot: ActivationSnapshot,
): ActivationPrerequisite[] {
  return evaluateActivationPrerequisites(snapshot).filter((item) => !item.met);
}
