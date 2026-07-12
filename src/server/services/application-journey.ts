import { ApplicationStatus } from "@/generated/prisma/client";
import type { DocumentType } from "@/generated/prisma/client";
import { REQUIRED_DOCUMENT_TYPES } from "@/lib/documents";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationView,
} from "@/server/services/application-service";

/**
 * Participant-safe application journey (Story 2.6). A DEDICATED view model —
 * not a filtered internal query: it is built purely from status-shaped data,
 * so eligibility rationale, interview notes, background detail, case notes,
 * and decision reasons are structurally absent, never merely hidden
 * (docs/product/participant-lifecycle.md: "The participant sees a simplified
 * journey and a clear current step, not the full internal operational
 * complexity"). Copy follows docs/ux/content-style-guide.md.
 */

/** The four simplified steps every application walks through. */
export const JOURNEY_STEP_KEYS = ["PREPARE", "SUBMIT", "REVIEW", "DECISION"] as const;
export type JourneyStepKey = (typeof JOURNEY_STEP_KEYS)[number];

const JOURNEY_STEP_LABELS: Record<JourneyStepKey, string> = {
  PREPARE: "Prepare",
  SUBMIT: "Submit",
  REVIEW: "Review",
  DECISION: "Decision",
};

export interface JourneyStep {
  key: JourneyStepKey;
  label: string;
  state: "done" | "current" | "upcoming";
}

export interface JourneyNextStep {
  headline: string;
  description: string;
  /** Approved action-verb label (content-style-guide.md), or null when no action is needed. */
  actionLabel: string | null;
  actionHref: string | null;
  tone: "action" | "waiting" | "positive" | "closed";
}

export interface ApplicationJourneyView {
  applicationNumber: string;
  /** Participant-safe stage label (never an internal phase name). */
  stageLabel: string;
  submittedAtLabel: string | null;
  steps: JourneyStep[];
  nextStep: JourneyNextStep;
  isTerminal: boolean;
  /** Stated plainly for terminal applications; null while in flight. */
  canReapply: boolean | null;
}

/** How far along the four simplified steps each internal status sits. */
const CURRENT_STEP: Record<ApplicationStatus, JourneyStepKey | "COMPLETE"> = {
  [ApplicationStatus.DRAFT]: "PREPARE",
  [ApplicationStatus.SUBMITTED]: "REVIEW",
  [ApplicationStatus.ELIGIBILITY_REVIEW]: "REVIEW",
  [ApplicationStatus.INTERVIEW]: "REVIEW",
  [ApplicationStatus.BACKGROUND_REVIEW]: "REVIEW",
  [ApplicationStatus.ACCEPTED]: "COMPLETE",
  [ApplicationStatus.REJECTED]: "COMPLETE",
  [ApplicationStatus.DISQUALIFIED]: "COMPLETE",
};

const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.DISQUALIFIED,
];

function buildSteps(status: ApplicationStatus): JourneyStep[] {
  const current = CURRENT_STEP[status];
  const currentIndex =
    current === "COMPLETE" ? JOURNEY_STEP_KEYS.length : JOURNEY_STEP_KEYS.indexOf(current);
  return JOURNEY_STEP_KEYS.map((key, index) => ({
    key,
    label: JOURNEY_STEP_LABELS[key],
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

function buildNextStep(
  status: ApplicationStatus,
  missingRequiredDocument: boolean,
): JourneyNextStep {
  switch (status) {
    case ApplicationStatus.DRAFT:
      return {
        headline: "Pick up where you left off",
        description:
          "Your draft is saved exactly as you left it. Finish at your own pace, then submit when you're ready.",
        actionLabel: "Continue Application",
        actionHref: "#application-form",
        tone: "action",
      };
    case ApplicationStatus.SUBMITTED:
    case ApplicationStatus.ELIGIBILITY_REVIEW:
    case ApplicationStatus.INTERVIEW:
    case ApplicationStatus.BACKGROUND_REVIEW:
      if (missingRequiredDocument) {
        return {
          headline: "We need one more document",
          description:
            "One required document is missing from your application. Uploading it below keeps your review moving.",
          actionLabel: "Upload Document",
          actionHref: "#documents",
          tone: "action",
        };
      }
      return {
        headline: "Your application is under review",
        description:
          "Our team is reading it with care. No action is needed right now — we'll let you know the moment something changes.",
        actionLabel: null,
        actionHref: null,
        tone: "waiting",
      };
    case ApplicationStatus.ACCEPTED:
      return {
        headline: "You've been accepted — welcome to Project Nova",
        description:
          "Next comes onboarding: our team will reach out to get you started. We're glad you're here.",
        actionLabel: null,
        actionHref: null,
        tone: "positive",
      };
    case ApplicationStatus.REJECTED:
      return {
        headline: "This application is closed",
        description:
          "Thank you for applying. You may apply again whenever you're ready — a new application is reviewed with fresh eyes.",
        actionLabel: null,
        actionHref: null,
        tone: "closed",
      };
    case ApplicationStatus.DISQUALIFIED:
      return {
        headline: "This application is closed",
        description:
          "A new application can't be started on this account. If you have questions or think this is a mistake, please contact Project Nova — we're glad to talk it through with you.",
        actionLabel: null,
        actionHref: null,
        tone: "closed",
      };
  }
}

/**
 * Pure mapping from an applicant's own ApplicationView to the journey.
 * `activeDocumentTypes` drives the "we need one more document" state when a
 * required document goes missing mid-review (Operations-initiated, 2.8).
 */
export function toJourneyView(
  application: ApplicationView,
  activeDocumentTypes: readonly DocumentType[] = REQUIRED_DOCUMENT_TYPES,
): ApplicationJourneyView {
  const isTerminal = TERMINAL_STATUSES.includes(application.status);
  const missingRequiredDocument =
    !isTerminal &&
    application.status !== ApplicationStatus.DRAFT &&
    REQUIRED_DOCUMENT_TYPES.some((type) => !activeDocumentTypes.includes(type));

  return {
    applicationNumber: application.applicationNumber,
    stageLabel: APPLICATION_STATUS_LABELS[application.status],
    submittedAtLabel: application.submittedAtLabel,
    steps: buildSteps(application.status),
    nextStep: buildNextStep(application.status, missingRequiredDocument),
    isTerminal,
    canReapply: isTerminal ? application.status === ApplicationStatus.REJECTED : null,
  };
}
