/**
 * Restricted screen state (Story 2.7; docs/ux/wireframe-spec.md) — visually
 * and semantically DISTINCT from Permission denied: the viewer is allowed to
 * know the section exists, but its content requires an explicitly granted
 * restricted permission (authorization-rbac.md). Rendered as a calm inline
 * panel (not role="alert" — this is an expected state, not an error), with
 * a shield icon + text, never color alone.
 */
export function Restricted({
  title = "Restricted content",
  description = "This section requires restricted review access, which is granted separately from your role and is audited. If your work requires it, contact your Nova administrator.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex max-w-prose items-start gap-3 rounded-lg border border-base-300 bg-base-200/50 p-5">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-6 shrink-0 text-base-content/60"
      >
        <path d="M12 3 5 6v5c0 4.5 3 8.2 7 9.5 4-1.3 7-5 7-9.5V6z" />
        <path d="M9.5 11.5h5m-5 3h3" />
      </svg>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-base-content/80">{description}</p>
      </div>
    </div>
  );
}
