"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fieldErrorsFromZod, fundingSourceInputSchema } from "@/features/funding/validation";
import { requireAuthContext } from "@/server/auth/context";
import { AppError } from "@/server/errors/app-error";
import {
  createFundingSource,
  deactivateFundingSource,
  reactivateFundingSource,
  updateFundingSource,
} from "@/server/services/funding-source-service";

/**
 * Funding-source Server Actions (Story 1.8; ADR-009). Actions delegate to
 * the service — no domain rules here (docs/architecture/coding-standards.md).
 * Expected failures return typed state; redirects happen outside try/catch
 * so NEXT_REDIRECT is never swallowed.
 */

export interface FundingFormState {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Record<string, string>;
}

const LIST_PATH = "/operations/administration/funding-sources";

function parseForm(formData: FormData) {
  return fundingSourceInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    code: String(formData.get("code") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

export async function createFundingSourceAction(
  _prev: FundingFormState,
  formData: FormData,
): Promise<FundingFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    const ctx = await requireAuthContext();
    await createFundingSource(ctx, parsed.data);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateFundingSourceAction(
  id: string,
  _prev: FundingFormState,
  formData: FormData,
): Promise<FundingFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    const ctx = await requireAuthContext();
    await updateFundingSource(ctx, id, parsed.data);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

export async function deactivateFundingSourceAction(id: string): Promise<void> {
  const ctx = await requireAuthContext();
  await deactivateFundingSource(ctx, id);
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}

export async function reactivateFundingSourceAction(id: string): Promise<void> {
  const ctx = await requireAuthContext();
  await reactivateFundingSource(ctx, id);
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}
