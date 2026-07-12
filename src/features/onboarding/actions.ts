"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fieldErrorsFromZod, onboardingInputSchema } from "@/features/onboarding/validation";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import { completeApplicantOnboarding } from "@/server/services/applicant-onboarding";

/**
 * Applicant onboarding Server Action (Story 2.2; ADR-009). Delegates to the
 * service; the Person is linked to the server-resolved user only — any
 * client-supplied identifier is ignored by construction (there is no such
 * field). Redirect happens outside try/catch so NEXT_REDIRECT propagates.
 */

export interface OnboardingFormState {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string>;
}

export async function completeOnboardingAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = onboardingInputSchema.safeParse({
    legalFirstName: String(formData.get("legalFirstName") ?? ""),
    legalLastName: String(formData.get("legalLastName") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    mailingAddressLine1: String(formData.get("mailingAddressLine1") ?? ""),
    mailingAddressLine2: String(formData.get("mailingAddressLine2") ?? ""),
    city: String(formData.get("city") ?? ""),
    region: String(formData.get("region") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await completeApplicantOnboarding(ctx, parsed.data);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant");
  redirect("/participant");
}
