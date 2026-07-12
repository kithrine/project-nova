"use server";

import { revalidatePath } from "next/cache";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import { addCaseNote } from "@/server/services/application-review-service";

/**
 * Operations review Server Actions (Story 2.7; ADR-009). Thin: parse,
 * delegate, map typed errors to form state.
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
