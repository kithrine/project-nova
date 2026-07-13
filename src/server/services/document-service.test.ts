import { describe, expect, it } from "vitest";

import { DocumentStatus, DocumentType } from "@/generated/prisma/client";
import type { Document } from "@/generated/prisma/client";
import {
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOCUMENT_TYPES,
  toDocumentView,
  uploadPathnamePrefix,
} from "./document-service";

describe("document type registry", () => {
  it("labels every document type", () => {
    for (const type of Object.values(DocumentType)) {
      expect(DOCUMENT_TYPE_LABELS[type], `missing label for ${type}`).toBeTruthy();
    }
  });

  it("requires government-issued identification", () => {
    expect(REQUIRED_DOCUMENT_TYPES).toContain(DocumentType.GOVERNMENT_ID);
  });
});

describe("uploadPathnamePrefix", () => {
  it("confines uploads to an application- and type-specific prefix", () => {
    expect(uploadPathnamePrefix("app_1", DocumentType.GOVERNMENT_ID)).toBe(
      "applications/app_1/GOVERNMENT_ID/",
    );
  });
});

describe("toDocumentView (Highly Restricted shaping)", () => {
  const document: Document = {
    id: "doc_1",
    applicationId: "app_1",
    certificationId: null,
    documentType: DocumentType.GOVERNMENT_ID,
    status: DocumentStatus.ACTIVE,
    fileName: "id-front.png",
    contentType: "image/png",
    sizeBytes: 24_000,
    storagePathname: "applications/app_1/GOVERNMENT_ID/document-abc123.png",
    storageUrl: "https://example.blob.vercel-storage.com/secret-abc123.png",
    uploadedByUserId: "user_1",
    supersededAt: null,
    createdAt: new Date("2026-07-11T00:00:00Z"),
    updatedAt: new Date("2026-07-11T00:00:00Z"),
  };

  it("exposes metadata only", () => {
    const view = toDocumentView(document);
    expect(view.fileName).toBe("id-front.png");
    expect(view.typeLabel).toBe("Government-issued ID");
    expect(view.sizeBytes).toBe(24_000);
  });

  it("NEVER leaks the storage URL or pathname", () => {
    const serialized = JSON.stringify(toDocumentView(document));
    expect(serialized).not.toContain("vercel-storage");
    expect(serialized).not.toContain("storageUrl");
    expect(serialized).not.toContain("storagePathname");
    expect(serialized).not.toContain("applications/app_1");
  });
});
