"use server";

import { revalidatePath } from "next/cache";

import { TrainingCompletionMethod, TrainingEnrollmentStatus } from "@/generated/prisma/client";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  createTrainingEnrollment,
  transitionTrainingEnrollment,
} from "@/server/services/training-service";
import {
  trainingEnrollmentInputSchema,
  trainingFieldErrors,
  trainingTransitionInputSchema,
} from "./validation";

export interface TrainingActionState {
  status: "idle" | "error" | "done";
  formError?: string;
  fieldErrors?: Record<string, string>;
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function revalidateTraining(enrollmentId: string): void {
  revalidatePath(`/operations/enrollments/${enrollmentId}`);
  revalidatePath("/participant");
}

export async function enrollTrainingAction(
  enrollmentId: string,
  _previous: TrainingActionState,
  formData: FormData,
): Promise<TrainingActionState> {
  const parsed = trainingEnrollmentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: trainingFieldErrors(parsed.error) };
  }
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await createTrainingEnrollment(ctx, {
      programEnrollmentId: enrollmentId,
      trainingProgramId: parsed.data.trainingProgramId,
      enrolledAt: utcDate(parsed.data.enrolledAt),
      expectedCompletionDate: parsed.data.expectedCompletionDate
        ? utcDate(parsed.data.expectedCompletionDate)
        : null,
      providerName: parsed.data.providerName,
    });
  } catch (error) {
    if (error instanceof AppError) {
      revalidateTraining(enrollmentId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }
  revalidateTraining(enrollmentId);
  return { status: "done" };
}

export async function transitionTrainingAction(
  enrollmentId: string,
  trainingEnrollmentId: string,
  toStatus: TrainingEnrollmentStatus,
  _previous: TrainingActionState,
  formData: FormData,
): Promise<TrainingActionState> {
  const parsed = trainingTransitionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: trainingFieldErrors(parsed.error) };
  }
  if (toStatus === TrainingEnrollmentStatus.COMPLETED && !parsed.data.completionMethod) {
    return {
      status: "error",
      fieldErrors: { completionMethod: "Choose how completion was verified." },
    };
  }
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await transitionTrainingEnrollment(ctx, {
      trainingEnrollmentId,
      toStatus,
      effectiveDate: utcDate(parsed.data.effectiveDate),
      completionMethod: parsed.data.completionMethod
        ? (parsed.data.completionMethod as TrainingCompletionMethod)
        : null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      revalidateTraining(enrollmentId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }
  revalidateTraining(enrollmentId);
  return { status: "done" };
}
