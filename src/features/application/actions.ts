"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { draftInputSchema, fieldErrorsFromZod } from "@/features/application/validation";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import { saveDraft, startOrResumeApplication } from "@/server/services/application-service";

/**
 * Draft application Server Actions (Story 2.3; ADR-009). Thin: parse,
 * delegate, map typed errors to form state. Redirects stay outside
 * try/catch so NEXT_REDIRECT propagates.
 */

export interface DraftFormState {
  status: "idle" | "error" | "conflict" | "saved";
  formError?: string;
  fieldErrors?: Record<string, string>;
  /** Fresh concurrency token after a successful save. */
  updatedAtToken?: string;
  savedAtLabel?: string;
}

export async function startApplicationAction(): Promise<void> {
  const ctx = await getOrProvisionAuthContext();
  if (!ctx) throw new AuthenticationError();
  await startOrResumeApplication(ctx);
  revalidatePath("/participant/application");
  redirect("/participant/application");
}

export async function saveDraftAction(
  applicationId: string,
  _prev: DraftFormState,
  formData: FormData,
): Promise<DraftFormState> {
  const parsed = draftInputSchema.safeParse({
    motivation: String(formData.get("motivation") ?? ""),
    workExperience: String(formData.get("workExperience") ?? ""),
    animalExperience: String(formData.get("animalExperience") ?? ""),
    availabilityNotes: String(formData.get("availabilityNotes") ?? ""),
    transportationNotes: String(formData.get("transportationNotes") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const expectedToken = String(formData.get("updatedAtToken") ?? "");

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    const saved = await saveDraft(ctx, applicationId, parsed.data, expectedToken);
    revalidatePath("/participant/application");
    return {
      status: "saved",
      updatedAtToken: saved.updatedAtToken,
      savedAtLabel: "Draft saved",
    };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "CONFLICT") {
        return { status: "conflict", formError: error.message };
      }
      return { status: "error", formError: error.message };
    }
    throw error;
  }
}
