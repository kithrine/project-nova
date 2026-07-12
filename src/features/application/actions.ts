"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { draftInputSchema, fieldErrorsFromZod } from "@/features/application/validation";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  saveDraft,
  startOrResumeApplication,
  submitApplication,
} from "@/server/services/application-service";

/**
 * Application Server Actions (Stories 2.3, 2.5; ADR-009). Thin: parse,
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
      // LIFECYCLE here means the application was submitted from another tab
      // while this one still showed the form — the Concurrent update state
      // (with its reload affordance) is the honest response, not a dead-end
      // error (Story 2.5, AC6).
      if (error.code === "CONFLICT" || error.code === "LIFECYCLE") {
        return { status: "conflict", formError: error.message };
      }
      return { status: "error", formError: error.message };
    }
    throw error;
  }
}

export interface SubmitFormState {
  status: "idle" | "error" | "conflict" | "lifecycle";
  formError?: string;
}

export async function submitApplicationAction(
  applicationId: string,
  _prev: SubmitFormState,
  formData: FormData,
): Promise<SubmitFormState> {
  const expectedToken = String(formData.get("updatedAtToken") ?? "");

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await submitApplication(ctx, applicationId, expectedToken);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "CONFLICT") {
        return { status: "conflict", formError: error.message };
      }
      if (error.code === "LIFECYCLE") {
        return { status: "lifecycle", formError: error.message };
      }
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant/application");
  // The page renders the success confirmation from this flag (role="status",
  // announced to assistive technology) — it survives a reload, unlike
  // client-side state that revalidation would unmount.
  redirect("/participant/application?submitted=1");
}
