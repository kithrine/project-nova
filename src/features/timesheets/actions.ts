"use server";

import { revalidatePath } from "next/cache";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  addWorkEntry,
  removeWorkEntry,
  updateWorkEntry,
  type WorkEntryInput,
} from "@/server/services/timesheet-service";

/**
 * Timesheet Server Actions (Story 6.2). Thin: parse the form, delegate,
 * map typed errors. The contract carries NO hours field — the server
 * computes hours from start/end/break (Story 6.3), so a spoofed value
 * has nowhere to enter.
 */

export interface TimesheetFormState {
  status: "idle" | "error" | "saved";
  formError?: string;
}

function parseEntryInput(formData: FormData): WorkEntryInput {
  const workDateRaw = String(formData.get("workDate") ?? "");
  const breakRaw = String(formData.get("breakMinutes") ?? "0").trim();
  const note = String(formData.get("note") ?? "").trim();
  return {
    workDate: /^\d{4}-\d{2}-\d{2}$/.test(workDateRaw)
      ? new Date(`${workDateRaw}T00:00:00.000Z`)
      : new Date(Number.NaN),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    breakMinutes: /^\d+$/.test(breakRaw) ? Number(breakRaw) : Number.NaN,
    note: note.length > 0 ? note : null,
  };
}

export async function addWorkEntryAction(
  timesheetId: string,
  _prev: TimesheetFormState,
  formData: FormData,
): Promise<TimesheetFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await addWorkEntry(ctx, timesheetId, parseEntryInput(formData));
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant/hours");
  return { status: "saved" };
}

export async function updateWorkEntryAction(
  entryId: string,
  _prev: TimesheetFormState,
  formData: FormData,
): Promise<TimesheetFormState> {
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await updateWorkEntry(ctx, entryId, parseEntryInput(formData));
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant/hours");
  return { status: "saved" };
}

export async function removeWorkEntryAction(
  entryId: string,
  _prev: TimesheetFormState,
  _formData: FormData,
): Promise<TimesheetFormState> {
  void _formData;
  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await removeWorkEntry(ctx, entryId);
  } catch (error) {
    if (error instanceof AppError) {
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath("/participant/hours");
  return { status: "saved" };
}
