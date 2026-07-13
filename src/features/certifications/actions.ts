"use server";

import { revalidatePath } from "next/cache";

import { ActiveStatus } from "@/generated/prisma/enums";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { AppError, AuthenticationError } from "@/server/errors/app-error";
import {
  recordCertification,
  updateCertification,
} from "@/server/services/certification-service";

/**
 * Certification Server Actions (Story 3.5; ADR-009). Thin: parse, delegate,
 * map typed errors. Dates arrive as date-input strings and are pinned to
 * UTC so they round-trip identically everywhere (the 2.9 convention).
 */

export interface CertificationActionState {
  status: "idle" | "error" | "done";
  formError?: string;
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseFields(formData: FormData) {
  const expiresOnRaw = String(formData.get("expiresOn") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    issuer: String(formData.get("issuer") ?? "").trim(),
    issuedOn: utcDate(String(formData.get("issuedOn") ?? "")),
    expiresOn: expiresOnRaw ? utcDate(expiresOnRaw) : null,
    requiredForMatching: formData.get("requiredForMatching") === "on",
  };
}

function validatePresence(fields: ReturnType<typeof parseFields>): string | null {
  if (!fields.name) return "Name the certification.";
  if (!fields.issuer) return "Name the issuer.";
  if (Number.isNaN(fields.issuedOn.getTime())) return "Choose a valid issue date.";
  return null;
}

export async function recordCertificationAction(
  participantId: string,
  enrollmentId: string,
  _prev: CertificationActionState,
  formData: FormData,
): Promise<CertificationActionState> {
  const fields = parseFields(formData);
  const missing = validatePresence(fields);
  if (missing) {
    return { status: "error", formError: missing };
  }

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await recordCertification(ctx, participantId, fields);
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/enrollments/${enrollmentId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/enrollments/${enrollmentId}`);
  revalidatePath("/participant/certifications");
  return { status: "done" };
}

export async function updateCertificationAction(
  certificationId: string,
  enrollmentId: string,
  _prev: CertificationActionState,
  formData: FormData,
): Promise<CertificationActionState> {
  const fields = parseFields(formData);
  const missing = validatePresence(fields);
  if (missing) {
    return { status: "error", formError: missing };
  }
  const statusRaw = String(formData.get("status") ?? ActiveStatus.ACTIVE);
  const status = Object.values(ActiveStatus).includes(statusRaw as ActiveStatus)
    ? (statusRaw as ActiveStatus)
    : ActiveStatus.ACTIVE;

  try {
    const ctx = await getOrProvisionAuthContext();
    if (!ctx) throw new AuthenticationError();
    await updateCertification(ctx, certificationId, { ...fields, status });
  } catch (error) {
    if (error instanceof AppError) {
      revalidatePath(`/operations/enrollments/${enrollmentId}`);
      return { status: "error", formError: error.message };
    }
    throw error;
  }

  revalidatePath(`/operations/enrollments/${enrollmentId}`);
  revalidatePath("/participant/certifications");
  return { status: "done" };
}
