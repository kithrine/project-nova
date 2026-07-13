"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  createMatchDraft,
  updateMatchDraft,
  withdrawMatchDraft,
} from "@/server/services/matching-service";

/**
 * Match draft Server Actions (Story 4.3; ADR-009). Thin: parse, delegate,
 * map typed errors. Redirects stay outside try/catch so NEXT_REDIRECT
 * propagates.
 */

export interface MatchFormState {
  status: "idle" | "error" | "saved";
  formError?: string;
}

function utcDateOrNull(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export async function createMatchDraftAction(
  enrollmentId: string,
  siteId: string,
  _prev: MatchFormState,
  _formData: FormData,
): Promise<MatchFormState> {
  void _formData;
  let created: { id: string };
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    created = await createMatchDraft(ctx, { enrollmentId, siteId });
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/operations/placements");
  redirect(`/operations/placements/matches/${created.id}`);
}

export async function updateMatchDraftAction(
  matchId: string,
  _prev: MatchFormState,
  formData: FormData,
): Promise<MatchFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await updateMatchDraft(ctx, matchId, {
      siteId: String(formData.get("siteId") ?? ""),
      supervisorId: textOrNull(formData.get("supervisorId")),
      schedule: textOrNull(formData.get("schedule")),
      startDate: utcDateOrNull(String(formData.get("startDate") ?? "")),
      endDate: utcDateOrNull(String(formData.get("endDate") ?? "")),
      fundingSourceId: textOrNull(formData.get("fundingSourceId")),
      notes: textOrNull(formData.get("notes")),
    });
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/placements/matches/${matchId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/placements/matches/${matchId}`);
  revalidatePath("/operations/placements");
  return { status: "saved" };
}

export async function withdrawMatchDraftAction(
  matchId: string,
  _prev: MatchFormState,
  _formData: FormData,
): Promise<MatchFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await withdrawMatchDraft(ctx, matchId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/placements/matches/${matchId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/operations/placements");
  redirect("/operations/placements");
}
