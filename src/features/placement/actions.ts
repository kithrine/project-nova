"use server";

import { revalidatePath } from "next/cache";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import type { ScheduleDayInput } from "@/server/domain/placement";
import {
  approvePlacementPackage,
  proposePlacementPackage,
  requestPlacementChanges,
  saveAssignment,
} from "@/server/services/placement-service";

/**
 * Placement Server Actions (Story 5.2; ADR-009). Thin: parse form data,
 * delegate to the service, map typed errors; both workspaces revalidate.
 */

export interface PlacementFormState {
  status: "idle" | "error" | "saved";
  formError?: string;
}

const DAY_KEYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

function textOrNull(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function revalidateWorkspaces(placementId: string) {
  revalidatePath(`/operations/placements/records/${placementId}`);
  revalidatePath(`/shelter/placements/${placementId}`);
  revalidatePath("/operations/placements");
  revalidatePath("/shelter/placements");
  revalidatePath("/shelter");
  revalidatePath("/participant/placement");
}

export async function saveAssignmentAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  const days: ScheduleDayInput[] = [];
  for (const day of DAY_KEYS) {
    if (formData.get(`day-${day}`) === "on") {
      days.push({
        day,
        startTime: String(formData.get(`start-${day}`) ?? ""),
        endTime: String(formData.get(`end-${day}`) ?? ""),
      });
    }
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await saveAssignment(ctx, placementId, {
      siteId: String(formData.get("siteId") ?? ""),
      supervisorId: textOrNull(formData.get("supervisorId")),
      coordinatorUserId: textOrNull(formData.get("coordinatorUserId")),
      days,
      weeklyHoursTarget: textOrNull(formData.get("weeklyHoursTarget")),
    });
  } catch (error) {
    if (error instanceof AppError) {
      revalidateWorkspaces(placementId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidateWorkspaces(placementId);
  return { status: "saved" };
}

export async function proposePlacementPackageAction(
  placementId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await proposePlacementPackage(ctx, placementId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidateWorkspaces(placementId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidateWorkspaces(placementId);
  return { status: "saved" };
}

export async function approvePlacementPackageAction(
  placementId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await approvePlacementPackage(ctx, placementId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidateWorkspaces(placementId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidateWorkspaces(placementId);
  return { status: "saved" };
}

export async function requestPlacementChangesAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await requestPlacementChanges(ctx, placementId, textOrNull(formData.get("note")));
  } catch (error) {
    if (error instanceof AppError) {
      revalidateWorkspaces(placementId);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidateWorkspaces(placementId);
  return { status: "saved" };
}
