"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { validateDocumentFile } from "@/lib/documents";
import {
  recordCertificationAction,
  updateCertificationAction,
  type CertificationActionState,
} from "@/features/certifications/actions";
import type { CertificationView } from "@/server/services/certification-service";

/**
 * Certifications panel (Story 3.5; ADR-017) — the Training section's
 * credential records. Recording and correcting are coordinator actions;
 * corrections preserve prior values in the audit trail. Attachments ride
 * the 2.4 direct-upload flow with the certification as the document's
 * single owning context. Status is text + icon, never color alone.
 */

function ExpiryIcon({ state }: { state: CertificationView["expiryState"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (state === "EXPIRED") {
    return (
      <svg {...common} className="mt-0.5 size-5 shrink-0 text-warning">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5h.01" />
      </svg>
    );
  }
  return (
    <svg {...common} className="mt-0.5 size-5 shrink-0 text-success">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

function CertificationFields({
  defaults,
  idPrefix,
}: {
  defaults?: Pick<
    CertificationView,
    "name" | "issuer" | "issuedOnValue" | "expiresOnValue" | "requiredForMatching"
  >;
  /** Unique per form instance — several edit forms can be open at once. */
  idPrefix: string;
}) {
  const prefix = idPrefix;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-cert-name`} className="text-sm font-medium">
          Certification
        </label>
        <input
          id={`${prefix}-cert-name`}
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-cert-issuer`} className="text-sm font-medium">
          Issuer
        </label>
        <input
          id={`${prefix}-cert-issuer`}
          name="issuer"
          required
          defaultValue={defaults?.issuer ?? ""}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-cert-issued`} className="text-sm font-medium">
          Issued on
        </label>
        <input
          id={`${prefix}-cert-issued`}
          type="date"
          name="issuedOn"
          required
          defaultValue={defaults?.issuedOnValue ?? ""}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-cert-expires`} className="text-sm font-medium">
          Expires on (optional)
        </label>
        <input
          id={`${prefix}-cert-expires`}
          type="date"
          name="expiresOn"
          defaultValue={defaults?.expiresOnValue ?? ""}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          name="requiredForMatching"
          defaultChecked={defaults?.requiredForMatching ?? false}
        />
        Required for matching
      </label>
    </div>
  );
}

function AttachControl({ certification }: { certification: CertificationView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<
    { phase: "idle" } | { phase: "uploading" } | { phase: "error"; message: string }
  >({ phase: "idle" });

  async function handleFile(file: File) {
    const invalid = validateDocumentFile({ contentType: file.type, sizeBytes: file.size });
    if (invalid) {
      setState({ phase: "error", message: invalid });
      return;
    }
    setState({ phase: "uploading" });
    try {
      const safeName = file.name.replace(/[^\w.\- ]/g, "_");
      const blob = await upload(
        `certifications/${certification.id}/${safeName}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({
            kind: "certification",
            certificationId: certification.id,
          }),
        },
      );
      const confirmed = await fetch("/api/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificationId: certification.id,
          pathname: blob.pathname,
          fileName: file.name,
        }),
      });
      if (!confirmed.ok) {
        throw new Error("confirm failed");
      }
      setState({ phase: "idle" });
      router.refresh();
    } catch {
      setState({
        phase: "error",
        message: "That upload didn't go through. Please try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        id={`attach-${certification.id}`}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      <label
        htmlFor={`attach-${certification.id}`}
        className="cursor-pointer text-sm font-medium underline underline-offset-2"
      >
        {state.phase === "uploading"
          ? "Uploading…"
          : certification.documentId
            ? `Replace document: ${certification.name}`
            : `Attach document: ${certification.name}`}
      </label>
      {state.phase === "error" ? (
        <p role="alert" className="text-sm text-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function CertificationRow({
  certification,
  enrollmentId,
}: {
  certification: CertificationView;
  enrollmentId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateCertificationAction.bind(null, certification.id, enrollmentId),
    { status: "idle" } as CertificationActionState,
  );

  return (
    <li className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <div className="flex items-start gap-3">
        <ExpiryIcon state={certification.expiryState} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium">
            {certification.name}
            {certification.status === "INACTIVE" ? " (archived)" : ""}
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
            <span>{certification.issuer}</span>
            <span>Issued {certification.issuedOnLabel}</span>
            <span>
              {certification.expiresOnLabel
                ? `Expires ${certification.expiresOnLabel}`
                : "No expiration"}
            </span>
            <span className="font-medium">{certification.expiryLabel}</span>
            {certification.requiredForMatching ? <span>Required for matching</span> : null}
          </p>
          {certification.documentId ? (
            <a
              href={`/api/documents/${certification.documentId}/download`}
              className="w-fit text-xs font-medium underline underline-offset-2"
            >
              View document{certification.documentFileName ? ` (${certification.documentFileName})` : ""}
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
        >
          {editing ? "Close" : `Edit: ${certification.name}`}
        </button>
      </div>

      {editing ? (
        <form action={formAction} className="flex flex-col gap-3 border-t border-base-300 pt-3">
          <CertificationFields defaults={certification} idPrefix={`edit-${certification.id}`} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`status-${certification.id}`} className="text-sm font-medium">
              Record status
            </label>
            <select
              id={`status-${certification.id}`}
              name="status"
              defaultValue={certification.status}
              className="w-fit rounded-md border border-base-300 px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Archived (revoked or superseded)</option>
            </select>
          </div>
          <p className="max-w-prose text-xs text-base-content/60">
            Corrections keep the prior values in the audit trail — nothing is
            silently lost.
          </p>
          {state.status === "error" && state.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {state.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : `Save Changes: ${certification.name}`}
          </Button>
        </form>
      ) : (
        <AttachControl certification={certification} />
      )}
    </li>
  );
}

export function CertificationPanel({
  participantId,
  enrollmentId,
  certifications,
}: {
  participantId: string;
  enrollmentId: string;
  certifications: CertificationView[];
}) {
  const [state, formAction, pending] = useActionState(
    recordCertificationAction.bind(null, participantId, enrollmentId),
    { status: "idle" } as CertificationActionState,
  );

  return (
    <div className="flex flex-col gap-4">
      {certifications.length === 0 ? (
        <p className="max-w-prose text-sm text-base-content/70">
          No certifications recorded yet.
        </p>
      ) : (
        <ul className="flex max-w-2xl flex-col gap-2">
          {certifications.map((certification) => (
            <CertificationRow
              key={certification.id}
              certification={certification}
              enrollmentId={enrollmentId}
            />
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-col gap-3 border-t border-base-300 pt-4">
        <h3 className="text-sm font-semibold">Record a certification</h3>
        <CertificationFields idPrefix="new" />
        {state.status === "error" && state.formError ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
            {state.formError}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Recording…" : "Record Certification"}
        </Button>
      </form>
    </div>
  );
}
