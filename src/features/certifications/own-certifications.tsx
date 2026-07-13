import type { OwnCertificationView } from "@/server/services/certification-service";

/**
 * The participant's read-only certifications list (Story 3.5, AC4) —
 * plain language, accessible list semantics, status as text + icon (never
 * color alone), and no coordinator-only detail.
 */

function StateIcon({ expired }: { expired: boolean }) {
  if (expired) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-5 shrink-0 text-warning"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5h.01" />
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
      className="mt-0.5 size-5 shrink-0 text-success"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function OwnCertifications({
  certifications,
}: {
  certifications: OwnCertificationView[];
}) {
  if (certifications.length === 0) {
    return (
      <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        Nothing here yet — certifications you earn will show up on this page.
      </p>
    );
  }

  return (
    <ul aria-label="Your certifications" className="flex max-w-2xl flex-col gap-2">
      {certifications.map((certification) => (
        <li
          key={certification.id}
          className="flex items-start gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
        >
          <StateIcon expired={certification.expiryState === "EXPIRED"} />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{certification.name}</p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
              <span>{certification.issuer}</span>
              <span>Issued {certification.issuedOnLabel}</span>
              <span>
                {certification.expiresOnLabel
                  ? `Expires ${certification.expiresOnLabel}`
                  : "No expiration"}
              </span>
              <span className="font-medium">{certification.expiryLabel}</span>
            </p>
            {certification.expiryState === "EXPIRED" ? (
              <p className="text-xs text-base-content/70">
                This one has expired — your coordinator can help you renew it.
              </p>
            ) : null}
            {certification.documentId ? (
              <a
                href={`/api/documents/${certification.documentId}/download`}
                className="w-fit text-xs font-medium underline underline-offset-2"
              >
                View document: {certification.name}
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
