import { describe, expect, it } from "vitest";

import { formatFileSize, MAX_DOCUMENT_BYTES, validateDocumentFile } from "./documents";

describe("validateDocumentFile", () => {
  it("accepts the allowed types at reasonable sizes", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(validateDocumentFile({ contentType, sizeBytes: 1024 })).toBeNull();
    }
  });

  it("rejects unsupported types with an actionable message", () => {
    const message = validateDocumentFile({ contentType: "application/zip", sizeBytes: 10 });
    expect(message).toMatch(/pdf or a photo/i);
  });

  it("rejects oversized files", () => {
    const message = validateDocumentFile({
      contentType: "application/pdf",
      sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });
    expect(message).toMatch(/10 MB/);
  });

  it("rejects empty files", () => {
    expect(validateDocumentFile({ contentType: "image/png", sizeBytes: 0 })).toMatch(
      /empty/i,
    );
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB, and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
