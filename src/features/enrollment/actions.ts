"use server";

import { revalidatePath } from "next/cache";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  completeOnboardingTaskAsStaff,
  completeOwnOnboardingTask,
  reopenOnboardingTask,
} from "@/server/services/enrollment-service";

/**
 * Onboarding task Server Actions (Story 3.3; ADR-009). Thin: delegate,
 * map typed errors to form state, revalidate both surfaces that show
 * progress (the participant dashboard and the enrollment workspace).
 */

export interface TaskActionState {
  status: "idle" | "error" | "done";
  formError?: string;
}

export async function completeOwnTaskAction(
  taskId: string,
  _prev: TaskActionState,
  _formData: FormData,
): Promise<TaskActionState> {
  void _formData; // useActionState signature; the task id is bound
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await completeOwnOnboardingTask(ctx, taskId);
  } catch (error) {
    if (error instanceof AppError) {
      // Revalidate even on failure so the losing side of a race converges
      // to the true state instead of re-failing against a stale row.
      revalidatePath("/participant");
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant");
  return { status: "done" };
}

export async function staffCompleteTaskAction(
  enrollmentId: string,
  taskId: string,
  _prev: TaskActionState,
  _formData: FormData,
): Promise<TaskActionState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await completeOnboardingTaskAsStaff(ctx, taskId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/enrollments/${enrollmentId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/enrollments/${enrollmentId}`);
  return { status: "done" };
}

export async function reopenTaskAction(
  enrollmentId: string,
  taskId: string,
  _prev: TaskActionState,
  _formData: FormData,
): Promise<TaskActionState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await reopenOnboardingTask(ctx, taskId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/enrollments/${enrollmentId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/enrollments/${enrollmentId}`);
  return { status: "done" };
}
