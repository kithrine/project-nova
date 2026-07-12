import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));

import { DocumentStatus, DocumentType } from "@/generated/prisma/client";
import type { ChecklistItem } from "@/server/services/document-service";
import { DocumentChecklist } from "./document-checklist";

const items: ChecklistItem[] = [
  {
    documentType: DocumentType.GOVERNMENT_ID,
    typeLabel: "Government-issued ID",
    required: true,
    current: null,
  },
  {
    documentType: DocumentType.OTHER,
    typeLabel: "Other supporting document",
    required: false,
    current: {
      id: "doc_2",
      documentType: DocumentType.OTHER,
      typeLabel: "Other supporting document",
      fileName: "reference-letter.pdf",
      contentType: "application/pdf",
      sizeBytes: 52_000,
      status: DocumentStatus.ACTIVE,
      uploadedAt: "2026-07-11T00:00:00.000Z",
    },
  },
];

describe("DocumentChecklist", () => {
  it("shows missing-vs-uploaded with text (never color alone)", () => {
    render(<DocumentChecklist applicationId="app_1" items={items} />);

    expect(screen.getByText(/missing — please upload this document/i)).toBeInTheDocument();
    expect(screen.getByText(/uploaded: reference-letter\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText("(required)")).toBeInTheDocument();
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("uses a standard, keyboard-reachable file picker — never drag-and-drop-only", () => {
    render(<DocumentChecklist applicationId="app_1" items={items} />);

    const uploadInput = screen.getByLabelText(/upload document/i);
    expect(uploadInput).toHaveAttribute("type", "file");
    expect(uploadInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,application/pdf",
    );
    // Replacement is offered for the already-uploaded document.
    expect(screen.getByLabelText(/replace document/i)).toHaveAttribute("type", "file");
  });

  it("routes the View link through the authorized download handler, not storage", () => {
    render(<DocumentChecklist applicationId="app_1" items={items} />);
    const link = screen.getByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/api/documents/doc_2/download");
    expect(link.getAttribute("href")).not.toContain("vercel-storage");
  });

  it("associates each picker with its status text for screen readers", () => {
    render(<DocumentChecklist applicationId="app_1" items={items} />);
    const listItems = screen.getAllByRole("listitem");
    const idItem = listItems[0];
    const input = within(idItem).getByLabelText(/upload document/i);
    expect(input).toHaveAttribute("aria-describedby", "status-GOVERNMENT_ID");
  });
});
