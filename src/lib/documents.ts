import { DocumentType } from "@/generated/prisma/enums";

/**
 * Pure document constants and validation (Story 2.4) — shared by the client
 * upload widget (pre-flight hints) and the server (enforcement). No server
 * imports here.
 */

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.GOVERNMENT_ID]: "Government-issued ID",
  [DocumentType.CERTIFICATION]: "Certification document",
  [DocumentType.OTHER]: "Other supporting document",
};

/** The document types that belong to an APPLICATION's checklist (2.3/2.4).
 *  CERTIFICATION documents belong to the certification owning context (3.5)
 *  and must never appear as application upload rows. */
export const APPLICATION_DOCUMENT_TYPES: readonly DocumentType[] = [
  DocumentType.GOVERNMENT_ID,
  DocumentType.OTHER,
];

/** Which document types an application requires (admin tooling later).
 *  Lives here (not in document-service) so submission completeness (2.5)
 *  can consume the same policy without a service-to-service cycle. */
export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  DocumentType.GOVERNMENT_ID,
];

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateDocumentFile(input: {
  contentType: string;
  sizeBytes: number;
}): string | null {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(input.contentType)) {
    return "Use a PDF or a photo (JPG, PNG, or WebP).";
  }
  if (input.sizeBytes > MAX_DOCUMENT_BYTES) {
    return "Files can be up to 10 MB. Try a smaller file or a photo of the document.";
  }
  if (input.sizeBytes <= 0) {
    return "That file looks empty. Please choose the file again.";
  }
  return null;
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}
