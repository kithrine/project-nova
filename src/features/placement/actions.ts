"use server";

import { revalidatePath } from "next/cache";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import type { ScheduleDayInput } from "@/server/domain/placement";
import {
  activatePlacement,
  addPlacementCaseNote,
  approvePlacementPackage,
  assignFunding,
  completeOwnPlacementTask,
  completePlacementTask,
  editPlacementCaseNote,
  endFundingAssignment,
  initiatePlacementOnboarding,
  pausePlacement,
  proposePlacementPackage,
  requestPlacementChanges,
  resumePlacement,
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

/** Date inputs parse as UTC midnight for cross-environment determinism. */
function utcDate(value: FormDataEntryValue | null): Date {
  return new Date(`${String(value ?? "").trim()}T00:00:00.000Z`);
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

export async function initiatePlacementOnboardingAction(
  placementId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await initiatePlacementOnboarding(ctx, placementId);
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

export async function activatePlacementAction(
  placementId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await activatePlacement(ctx, placementId);
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

export async function addPlacementCaseNoteAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await addPlacementCaseNote(ctx, placementId, String(formData.get("body") ?? ""));
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  // Notes are Nova-internal — only the operations workspace re-renders.
  revalidatePath(`/operations/placements/records/${placementId}`);
  return { status: "saved" };
}

export async function editPlacementCaseNoteAction(
  placementId: string,
  noteId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await editPlacementCaseNote(ctx, noteId, String(formData.get("body") ?? ""));
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/placements/records/${placementId}`);
  return { status: "saved" };
}

export async function pausePlacementAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await pausePlacement(ctx, placementId, {
      reasonKey: String(formData.get("reasonKey") ?? ""),
      note: textOrNull(formData.get("note")),
      effectiveDate: utcDate(formData.get("effectiveDate")),
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

export async function resumePlacementAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await resumePlacement(ctx, placementId, utcDate(formData.get("resumeDate")));
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

export async function completePlacementTaskAction(
  placementId: string,
  taskId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await completePlacementTask(ctx, taskId);
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

export async function completeOwnPlacementTaskAction(
  taskId: string,
  _prev: PlacementFormState,
  _formData: FormData,
): Promise<PlacementFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await completeOwnPlacementTask(ctx, taskId);
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath("/participant/placement");
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant/placement");
  return { status: "saved" };
}

export async function assignFundingAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await assignFunding(ctx, placementId, {
      fundingSourceId: String(formData.get("fundingSourceId") ?? ""),
      startDate: utcDate(formData.get("startDate")),
      hourlyRate: textOrNull(formData.get("hourlyRate")),
      hoursCap: textOrNull(formData.get("hoursCap")),
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

export async function endFundingAssignmentAction(
  placementId: string,
  _prev: PlacementFormState,
  formData: FormData,
): Promise<PlacementFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await endFundingAssignment(ctx, placementId, utcDate(formData.get("endDate")));
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
