/**
 * Pure document constants and validation (Story 2.4) — shared by the client
 * upload widget (pre-flight hints) and the server (enforcement). No server
 * imports here.
 */

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
