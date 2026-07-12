import { head } from "@vercel/blob";

import { ApplicationStatus, DocumentStatus, DocumentType } from "@/generated/prisma/client";
import type { Document } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  AuthorizationError,
  LifecycleError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import { NON_TERMINAL_STATUSES } from "@/server/services/application-service";

/**
 * DocumentService (Story 2.4, ADR-014). Metadata in PostgreSQL; contents in
 * Vercel Blob. Contents are Highly Restricted: storage pathname/URL are
 * server-side secrets excluded from every view model and never logged.
 * Applicant access is ownership-scoped (no Membership, per 2.2/2.3);
 * Operations reviewers need document.view under Nova scope (2.7/2.8);
 * shelters are never granted access to application documents.
 */

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.GOVERNMENT_ID]: "Government-issued ID",
  [DocumentType.OTHER]: "Other supporting document",
};

/** Which document types an application requires (admin tooling later). */
export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  DocumentType.GOVERNMENT_ID,
];

export {
  ALLOWED_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  validateDocumentFile,
} from "@/lib/documents";
import { validateDocumentFile } from "@/lib/documents";

export interface DocumentView {
  id: string;
  documentType: DocumentType;
  typeLabel: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  uploadedAt: string;
}

export interface ChecklistItem {
  documentType: DocumentType;
  typeLabel: string;
  required: boolean;
  current: DocumentView | null;
}

/** Shape a Document — storage pathname/URL deliberately absent. */
export function toDocumentView(document: Document): DocumentView {
  return {
    id: document.id,
    documentType: document.documentType,
    typeLabel: DOCUMENT_TYPE_LABELS[document.documentType],
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    uploadedAt: document.createdAt.toISOString(),
  };
}

/** The blob pathname prefix an upload for this application/type must live under. */
export function uploadPathnamePrefix(applicationId: string, documentType: DocumentType) {
  return `applications/${applicationId}/${documentType}/`;
}

async function requireOwnedNonTerminalApplication(ctx: AuthContext, applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { person: { select: { userId: true } } },
  });
  // Ownership: foreign applications are a plain 404 — existence unconfirmed.
  if (!application || application.person.userId !== ctx.userId) {
    throw new NotFoundError();
  }
  if (
    !(NON_TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(application.status)
  ) {
    throw new LifecycleError(
      "This application is closed, so documents can no longer be added.",
    );
  }
  return application;
}

/**
 * Authorize an upload before a token is issued (called by the upload Route
 * Handler's onBeforeGenerateToken). Returns the constraints the token must
 * carry.
 */
export async function authorizeUpload(
  ctx: AuthContext,
  applicationId: string,
  documentType: DocumentType,
): Promise<{ pathnamePrefix: string }> {
  if (!Object.values(DocumentType).includes(documentType)) {
    throw new ValidationError("Choose a document type from the list.");
  }
  await requireOwnedNonTerminalApplication(ctx, applicationId);
  return { pathnamePrefix: uploadPathnamePrefix(applicationId, documentType) };
}

/**
 * Confirm a completed direct upload: verify the object server-side (it must
 * exist under the exact prefix this user was authorized for, with an allowed
 * type and size), then create the Document — superseding any prior ACTIVE
 * document of the same type in the same transaction. Idempotent by
 * storagePathname.
 */
export async function confirmUpload(
  ctx: AuthContext,
  input: {
    applicationId: string;
    documentType: DocumentType;
    pathname: string;
    /** Display name only (sanitized); type/size always come from storage. */
    fileName?: string;
  },
): Promise<DocumentView> {
  await requireOwnedNonTerminalApplication(ctx, input.applicationId);

  const prefix = uploadPathnamePrefix(input.applicationId, input.documentType);
  if (!input.pathname.startsWith(prefix)) {
    // A pathname outside the authorized prefix is someone else's object.
    throw new AuthorizationError();
  }

  // Server-side verification against storage — never trust client metadata.
  let blob;
  try {
    blob = await head(input.pathname);
  } catch {
    throw new ValidationError("We couldn't find that upload. Please try again.");
  }
  const invalid = validateDocumentFile({
    contentType: blob.contentType ?? "application/octet-stream",
    sizeBytes: blob.size,
  });
  if (invalid) {
    throw new ValidationError(invalid);
  }

  // Idempotent replay (double confirm) returns the existing record.
  const existing = await prisma.document.findUnique({
    where: { storagePathname: input.pathname },
  });
  if (existing) {
    return toDocumentView(existing);
  }

  const fileName = (
    input.fileName ?? decodeURIComponent(input.pathname.split("/").pop() ?? "document")
  )
    .replace(/[^\w.\- ]/g, "_")
    .slice(0, 200);

  const created = await prisma.$transaction(async (tx) => {
    await tx.document.updateMany({
      where: {
        applicationId: input.applicationId,
        documentType: input.documentType,
        status: DocumentStatus.ACTIVE,
      },
      data: { status: DocumentStatus.SUPERSEDED, supersededAt: new Date() },
    });
    return tx.document.create({
      data: {
        applicationId: input.applicationId,
        documentType: input.documentType,
        fileName,
        contentType: blob.contentType ?? "application/octet-stream",
        sizeBytes: blob.size,
        storagePathname: input.pathname,
        storageUrl: blob.url,
        uploadedByUserId: ctx.userId,
      },
    });
  });

  return toDocumentView(created);
}

/** The applicant's checklist: required vs uploaded, current ACTIVE doc per type. */
export async function getDocumentChecklist(
  ctx: AuthContext,
  applicationId: string,
): Promise<ChecklistItem[]> {
  await requireOwnedNonTerminalApplication(ctx, applicationId);

  const documents = await prisma.document.findMany({
    where: { applicationId, status: DocumentStatus.ACTIVE },
  });
  const byType = new Map(documents.map((d) => [d.documentType, toDocumentView(d)]));

  return Object.values(DocumentType).map((documentType) => ({
    documentType,
    typeLabel: DOCUMENT_TYPE_LABELS[documentType],
    required: REQUIRED_DOCUMENT_TYPES.includes(documentType),
    current: byType.get(documentType) ?? null,
  }));
}

/**
 * Authorize a download and return the server-side storage location for
 * streaming. Owners always; Nova staff with document.view under Nova scope
 * (Operations review, 2.7/2.8). Shelters: never. The store is PRIVATE
 * (ADR-014): objects require authenticated access even with the URL.
 */
export async function authorizeDownload(
  ctx: AuthContext,
  documentId: string,
): Promise<{ storagePathname: string; fileName: string; contentType: string }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      application: { include: { person: { select: { userId: true } } } },
    },
  });
  if (!document) {
    throw new NotFoundError();
  }

  const isOwner = document.application.person.userId === ctx.userId;
  const isNovaReviewer = hasPermission(ctx, "document.view") && hasNovaScope(ctx);
  if (!isOwner && !isNovaReviewer) {
    // Non-owners get the same 404 as a missing record — no existence leak.
    throw new NotFoundError();
  }

  return {
    storagePathname: document.storagePathname,
    fileName: document.fileName,
    contentType: document.contentType,
  };
}
