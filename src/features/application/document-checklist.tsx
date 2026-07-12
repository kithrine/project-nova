"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { DocumentType } from "@/generated/prisma/client";
import { formatFileSize, validateDocumentFile } from "@/lib/documents";
import type { ChecklistItem } from "@/server/services/document-service";

/**
 * File Upload + required-documents checklist (Story 2.4;
 * docs/ux/component-guidelines.md). A standard file picker is the
 * first-class control (no drag-and-drop-only path), with visible progress,
 * screen-reader announcements, and text+icon status — never color alone.
 */

type ItemState =
  | { phase: "idle" }
  | { phase: "uploading"; percent: number }
  | { phase: "error"; message: string };

function StatusIcon({ kind }: { kind: "uploaded" | "missing" | "optional" }) {
  if (kind === "uploaded") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 text-success"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={kind === "missing" ? "size-5 text-warning" : "size-5 text-base-content/40"}
    >
      <circle cx="12" cy="12" r="9" strokeDasharray={kind === "optional" ? "3 3" : undefined} />
      {kind === "missing" ? <path d="M12 8v5M12 16.5h.01" /> : null}
    </svg>
  );
}

export function DocumentChecklist({
  applicationId,
  items,
}: {
  applicationId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [states, setStates] = useState<Partial<Record<DocumentType, ItemState>>>({});
  const inputs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});

  const setItemState = (type: DocumentType, state: ItemState) =>
    setStates((prev) => ({ ...prev, [type]: state }));

  async function handleFile(item: ChecklistItem, file: File) {
    const invalid = validateDocumentFile({ contentType: file.type, sizeBytes: file.size });
    if (invalid) {
      setItemState(item.documentType, { phase: "error", message: invalid });
      return;
    }

    setItemState(item.documentType, { phase: "uploading", percent: 0 });
    try {
      // The requested pathname must sit under the server-authorized prefix
      // (the upload route validates this before signing).
      const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-120) || "document";
      const pathname = `applications/${applicationId}/${item.documentType}/${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
        clientPayload: JSON.stringify({
          applicationId,
          documentType: item.documentType,
        }),
        onUploadProgress: ({ percentage }) =>
          setItemState(item.documentType, {
            phase: "uploading",
            percent: Math.round(percentage),
          }),
      });

      const confirm = await fetch("/api/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          documentType: item.documentType,
          pathname: blob.pathname,
          fileName: file.name,
        }),
      });
      if (!confirm.ok) {
        const body = (await confirm.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "We couldn't save that upload.");
      }

      setItemState(item.documentType, { phase: "idle" });
      router.refresh();
    } catch (error) {
      setItemState(item.documentType, {
        phase: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "That upload didn't go through. Please try again.",
      });
    }
  }

  return (
    <ul className="flex max-w-2xl list-none flex-col gap-3">
      {items.map((item) => {
        const state = states[item.documentType] ?? { phase: "idle" };
        const inputId = `upload-${item.documentType}`;
        const statusId = `status-${item.documentType}`;
        const uploaded = item.current !== null;

        return (
          <li
            key={item.documentType}
            className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <StatusIcon
                  kind={uploaded ? "uploaded" : item.required ? "missing" : "optional"}
                />
                <div>
                  <p className="text-sm font-medium">
                    {item.typeLabel}{" "}
                    {item.required ? (
                      <span className="text-base-content/60">(required)</span>
                    ) : (
                      <span className="text-base-content/60">(optional)</span>
                    )}
                  </p>
                  <p id={statusId} className="text-sm text-base-content/70">
                    {uploaded && item.current
                      ? `Uploaded: ${item.current.fileName} (${formatFileSize(item.current.sizeBytes)})`
                      : item.required
                        ? "Missing — please upload this document"
                        : "Not uploaded"}
                  </p>
                </div>
              </div>
              {uploaded && item.current ? (
                <a
                  href={`/api/documents/${item.current.id}/download`}
                  className="shrink-0 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  View
                </a>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-1.5 text-sm font-medium hover:bg-base-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
              >
                {uploaded ? "Replace Document" : "Upload Document"}
                <input
                  ref={(el) => {
                    inputs.current[item.documentType] = el;
                  }}
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  aria-describedby={statusId}
                  disabled={state.phase === "uploading"}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(item, file);
                    event.target.value = "";
                  }}
                />
              </label>

              {state.phase === "uploading" ? (
                <div className="flex items-center gap-2" role="status">
                  <div
                    role="progressbar"
                    aria-valuenow={state.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Uploading ${item.typeLabel}`}
                    className="h-2 w-28 overflow-hidden rounded-full bg-base-200"
                  >
                    <div
                      className="h-full rounded-full bg-secondary transition-all"
                      style={{ width: `${state.percent}%` }}
                    />
                  </div>
                  <span className="text-sm text-base-content/70">{state.percent}%</span>
                </div>
              ) : null}
            </div>

            {state.phase === "error" ? (
              <p role="alert" className="text-sm text-error">
                {state.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
