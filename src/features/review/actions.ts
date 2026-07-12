"use server";

import { revalidatePath } from "next/cache";

import {
  BackgroundOutcome,
  EligibilityOutcome,
  InterviewFormat,
  InterviewOutcome,
} from "@/generated/prisma/enums";
import { isDecisionCategory } from "@/features/review/decision-categories";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  acceptApplication,
  addCaseNote,
  BACKGROUND_REJECTION_CATEGORIES,
  beginEligibilityReview,
  recordBackgroundDecision,
  recordEligibilityOutcome,
  recordInterviewOutcome,
  rejectApplication,
  scheduleInterview,
  type BackgroundRejectionCategory,
} from "@/server/services/application-review-service";

/**
 * Operations review Server Actions (Stories 2.7, 2.11; ADR-009). Thin:
 * parse, delegate, map typed errors to form state.
 */

export interface CaseNoteFormState {
  status: "idle" | "error" | "saved";
  formError?: string;
}

export async function addCaseNoteAction(
  applicationId: string,
  _prev: CaseNoteFormState,
  formData: FormData,
): Promise<CaseNoteFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await addCaseNote(ctx, applicationId, String(formData.get("body") ?? ""));
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  return { status: "saved" };
}

export interface DecisionFormState {
  status: "idle" | "error" | "decided";
  formError?: string;
}

export async function rejectApplicationAction(
  applicationId: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const category = String(formData.get("category") ?? "");
  if (!isDecisionCategory(category)) {
    return {
      status: "error",
      formError: "Choose a decision reason from the approved list.",
    };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await rejectApplication(ctx, applicationId, category);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}

export async function beginEligibilityReviewAction(
  applicationId: string,
  _prev: DecisionFormState,
  _formData: FormData,
): Promise<DecisionFormState> {
  void _formData; // useActionState signature; begin takes no form input
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await beginEligibilityReview(ctx, applicationId);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}

export async function recordEligibilityOutcomeAction(
  applicationId: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const outcomeRaw = String(formData.get("outcome") ?? "");
  if (!Object.values(EligibilityOutcome).includes(outcomeRaw as EligibilityOutcome)) {
    return { status: "error", formError: "Choose an outcome." };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await recordEligibilityOutcome(
      ctx,
      applicationId,
      outcomeRaw as EligibilityOutcome,
      String(formData.get("rationale") ?? ""),
    );
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}

export async function scheduleInterviewAction(
  applicationId: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const formatRaw = String(formData.get("format") ?? "");
  if (!Object.values(InterviewFormat).includes(formatRaw as InterviewFormat)) {
    return { status: "error", formError: "Choose an interview format." };
  }
  // datetime-local sends a zone-less value; interpret it as the program's
  // wall-clock time in UTC so it round-trips identically everywhere.
  const scheduledAt = new Date(`${scheduledAtRaw}:00.000Z`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { status: "error", formError: "Choose a valid date and time." };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await scheduleInterview(ctx, applicationId, scheduledAt, formatRaw as InterviewFormat);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  return { status: "decided" };
}

export async function recordInterviewOutcomeAction(
  applicationId: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const outcomeRaw = String(formData.get("outcome") ?? "");
  if (!Object.values(InterviewOutcome).includes(outcomeRaw as InterviewOutcome)) {
    return { status: "error", formError: "Choose an outcome." };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await recordInterviewOutcome(
      ctx,
      applicationId,
      outcomeRaw as InterviewOutcome,
      String(formData.get("notes") ?? ""),
    );
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}

export async function recordBackgroundDecisionAction(
  applicationId: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const outcomeRaw = String(formData.get("outcome") ?? "");
  if (!Object.values(BackgroundOutcome).includes(outcomeRaw as BackgroundOutcome)) {
    return { status: "error", formError: "Choose an outcome." };
  }
  const categoryRaw = String(formData.get("rejectionCategory") ?? "");
  const rejectionCategory = (
    BACKGROUND_REJECTION_CATEGORIES as readonly string[]
  ).includes(categoryRaw)
    ? (categoryRaw as BackgroundRejectionCategory)
    : undefined;

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await recordBackgroundDecision(
      ctx,
      applicationId,
      outcomeRaw as BackgroundOutcome,
      String(formData.get("rationale") ?? ""),
      rejectionCategory,
    );
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}

export async function acceptApplicationAction(
  applicationId: string,
  _prev: DecisionFormState,
  _formData: FormData,
): Promise<DecisionFormState> {
  void _formData; // useActionState signature; accept takes no form input
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await acceptApplication(ctx, applicationId);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/applications/${applicationId}`);
  revalidatePath("/operations/applications");
  return { status: "decided" };
}
