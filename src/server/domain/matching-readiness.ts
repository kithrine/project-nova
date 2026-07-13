import {
  ActiveStatus,
  OnboardingTaskStatus,
  TrainingEnrollmentStatus,
} from "@/generated/prisma/client";
import { certificationSatisfies } from "@/server/domain/certification";
import { getOutstandingRequiredTraining } from "@/server/domain/training-enrollment";

/**
 * The matching-readiness policy (Story 3.6) — the single computation behind
 * the coordinator Blocker List, the participant "path to matching" card,
 * and the 3.7 Ready-for-Matching gate, so what is DISPLAYED and what is
 * ENFORCED can never drift apart. Pure and read-only: callers load live
 * state and evaluate on demand — nothing here is cached or stored.
 *
 * Sources (ADR-017):
 * - Required onboarding tasks (3.2/3.3): every one must be COMPLETE.
 * - Required training programs (3.4): every one needs a COMPLETED attempt.
 * - Required certifications (3.5): an ACTIVE required record must be
 *   unexpired. A certification never recorded is NOT a blocker (credentials
 *   default to task-eligibility gates, not universal readiness), and an
 *   archived record no longer demands renewal.
 */

export interface ReadinessInputs {
  tasks: readonly {
    id: string;
    title: string;
    required: boolean;
    status: OnboardingTaskStatus;
  }[];
  /** ACTIVE training programs for the enrollment's program (caller filters). */
  trainingPrograms: readonly {
    id: string;
    name: string;
    requiredForMatching: boolean;
  }[];
  trainingAttempts: readonly {
    trainingProgramId: string;
    status: TrainingEnrollmentStatus;
  }[];
  certifications: readonly {
    id: string;
    name: string;
    requiredForMatching: boolean;
    status: ActiveStatus;
    expiresOn: Date | null;
  }[];
}

export interface MatchingBlocker {
  kind: "task" | "training" | "certification";
  /** The underlying record (task/certification) or catalog (training) id. */
  id: string;
  /** What is outstanding, named for a coordinator. */
  label: string;
  /** Which required item it maps to, and why it is outstanding. */
  detail: string;
  /** Enrollment-workspace anchor for the section that resolves it. */
  anchor: string;
}

export interface MatchingReadiness {
  ready: boolean;
  blockers: MatchingBlocker[];
}

export function computeMatchingReadiness(
  inputs: ReadinessInputs,
  now: Date = new Date(),
): MatchingReadiness {
  const blockers: MatchingBlocker[] = [];

  for (const task of inputs.tasks) {
    if (task.required && task.status !== OnboardingTaskStatus.COMPLETE) {
      blockers.push({
        kind: "task",
        id: task.id,
        label: task.title,
        detail: "Required onboarding task not complete",
        anchor: "#onboarding-tasks",
      });
    }
  }

  for (const outstanding of getOutstandingRequiredTraining(
    inputs.trainingPrograms,
    inputs.trainingAttempts,
  )) {
    blockers.push({
      kind: "training",
      id: outstanding.trainingProgramId,
      label: outstanding.name,
      detail: "Required training has no completed attempt",
      anchor: "#training",
    });
  }

  for (const certification of inputs.certifications) {
    if (
      certification.requiredForMatching &&
      certification.status === ActiveStatus.ACTIVE &&
      !certificationSatisfies(certification, now)
    ) {
      blockers.push({
        kind: "certification",
        id: certification.id,
        label: certification.name,
        detail: "Required certification has expired",
        anchor: "#certifications",
      });
    }
  }

  return { ready: blockers.length === 0, blockers };
}
