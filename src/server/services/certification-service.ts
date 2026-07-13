import { ActiveStatus, DocumentStatus } from "@/generated/prisma/client";
import type { Certification } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  certificationExpiryState,
  CERTIFICATION_EXPIRY_LABELS,
  type CertificationExpiryState,
} from "@/server/domain/certification";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

/**
 * Certification service (Story 3.5; ADR-017). Coordinator-recorded
 * credentials on a Participant. Corrections are EDITS with the prior values
 * snapshotted into the audit trail — never silently lost, never hard
 * deleted (RULES.md). Participants read their own certifications via
 * ownership; shelters have no access pre-placement.
 */

function requireRecordAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "certification.record")) throw new AuthorizationError();
  requireNovaScope(ctx);
}

function formatDate(date: Date | null): string | null {
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
}

/** Compact prior-values snapshot for the audit trail (AC5). */
function snapshot(certification: Certification): string {
  const expires = certification.expiresOn
    ? certification.expiresOn.toISOString().slice(0, 10)
    : "none";
  return [
    `name=${certification.name}`,
    `issuer=${certification.issuer}`,
    `issuedOn=${certification.issuedOn.toISOString().slice(0, 10)}`,
    `expiresOn=${expires}`,
    `required=${certification.requiredForMatching}`,
    `status=${certification.status}`,
  ].join("|");
}

export interface CertificationInput {
  name: string;
  issuer: string;
  issuedOn: Date;
  expiresOn?: Date | null;
  requiredForMatching: boolean;
}

function validateInput(input: CertificationInput): void {
  if (Number.isNaN(input.issuedOn.getTime())) {
    throw new ValidationError("Choose a valid issue date.");
  }
  if (input.expiresOn && Number.isNaN(input.expiresOn.getTime())) {
    throw new ValidationError("Choose a valid expiration date.");
  }
  if (input.expiresOn && input.expiresOn.getTime() < input.issuedOn.getTime()) {
    throw new ValidationError("Expiration cannot be before the issue date.");
  }
}

export async function recordCertification(
  ctx: AuthContext,
  participantId: string,
  input: CertificationInput,
): Promise<{ id: string }> {
  requireRecordAccess(ctx);
  validateInput(input);

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true },
  });
  if (!participant) throw new NotFoundError();

  return prisma.$transaction(async (tx) => {
    const created = await tx.certification.create({
      data: {
        participantId,
        name: input.name.trim(),
        issuer: input.issuer.trim(),
        issuedOn: input.issuedOn,
        expiresOn: input.expiresOn ?? null,
        requiredForMatching: input.requiredForMatching,
      },
      select: { id: true },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "certification.record",
        subjectType: "Certification",
        subjectId: created.id,
      },
    });
    return created;
  });
}

export async function updateCertification(
  ctx: AuthContext,
  certificationId: string,
  input: CertificationInput & { status: ActiveStatus },
): Promise<void> {
  requireRecordAccess(ctx);
  validateInput(input);

  const existing = await prisma.certification.findUnique({
    where: { id: certificationId },
  });
  if (!existing) throw new NotFoundError();

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certificationId },
      data: {
        name: input.name.trim(),
        issuer: input.issuer.trim(),
        issuedOn: input.issuedOn,
        expiresOn: input.expiresOn ?? null,
        requiredForMatching: input.requiredForMatching,
        status: input.status,
      },
    });
    // Prior values live on in the audit trail — a correction never erases
    // what the record said before (AC5).
    await tx.auditEvent.create({
      data: {
        actorUserId: ctx.userId,
        action: "certification.update",
        subjectType: "Certification",
        subjectId: certificationId,
        detail: snapshot(existing),
      },
    });
  });
}

export interface CertificationView {
  id: string;
  name: string;
  issuer: string;
  issuedOnLabel: string;
  expiresOnLabel: string | null;
  expiryState: CertificationExpiryState;
  expiryLabel: string;
  requiredForMatching: boolean;
  status: ActiveStatus;
  /** Latest ACTIVE supporting document, when one is attached. */
  documentId: string | null;
  documentFileName: string | null;
  /** Raw ISO dates for edit forms (ops view only). */
  issuedOnValue: string;
  expiresOnValue: string | null;
}

function toView(
  certification: Certification & {
    documents: { id: string; fileName: string }[];
  },
): CertificationView {
  return {
    id: certification.id,
    name: certification.name,
    issuer: certification.issuer,
    issuedOnLabel: formatDate(certification.issuedOn) ?? "",
    expiresOnLabel: formatDate(certification.expiresOn),
    expiryState: certificationExpiryState(certification.expiresOn),
    expiryLabel: CERTIFICATION_EXPIRY_LABELS[certificationExpiryState(certification.expiresOn)],
    requiredForMatching: certification.requiredForMatching,
    status: certification.status,
    documentId: certification.documents[0]?.id ?? null,
    documentFileName: certification.documents[0]?.fileName ?? null,
    issuedOnValue: certification.issuedOn.toISOString().slice(0, 10),
    expiresOnValue: certification.expiresOn
      ? certification.expiresOn.toISOString().slice(0, 10)
      : null,
  };
}

const ACTIVE_DOCUMENT_INCLUDE = {
  documents: {
    where: { status: DocumentStatus.ACTIVE },
    select: { id: true, fileName: true },
    take: 1,
  },
} as const;

/** Ops list: every certification on the participant, including archived. */
export async function listCertificationsForParticipant(
  ctx: AuthContext,
  participantId: string,
): Promise<CertificationView[]> {
  requireRecordAccess(ctx);
  const certifications = await prisma.certification.findMany({
    where: { participantId },
    orderBy: [{ issuedOn: "desc" }, { name: "asc" }],
    include: ACTIVE_DOCUMENT_INCLUDE,
  });
  return certifications.map(toView);
}

export interface OwnCertificationView {
  id: string;
  name: string;
  issuer: string;
  issuedOnLabel: string;
  expiresOnLabel: string | null;
  expiryState: CertificationExpiryState;
  expiryLabel: string;
  documentId: string | null;
}

/**
 * The participant's own certifications: ACTIVE records only, plain
 * language, no coordinator-only detail (no requiredForMatching flag, no
 * archived records) — AC4.
 */
export async function getOwnCertifications(
  ctx: AuthContext,
): Promise<OwnCertificationView[]> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return [];
  const certifications = await prisma.certification.findMany({
    where: { participantId: person.participant.id, status: ActiveStatus.ACTIVE },
    orderBy: [{ issuedOn: "desc" }, { name: "asc" }],
    include: ACTIVE_DOCUMENT_INCLUDE,
  });
  return certifications.map((certification) => {
    const view = toView(certification);
    return {
      id: view.id,
      name: view.name,
      issuer: view.issuer,
      issuedOnLabel: view.issuedOnLabel,
      expiresOnLabel: view.expiresOnLabel,
      expiryState: view.expiryState,
      expiryLabel: view.expiryLabel,
      documentId: view.documentId,
    };
  });
}
