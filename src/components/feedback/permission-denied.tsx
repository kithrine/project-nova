/**
 * Permission denied screen state (docs/ux/wireframe-spec.md).
 * Plain, respectful copy; no color-only signaling; no internal details.
 */
export function PermissionDenied({
  title = "You don't have access to this page",
  description = "If you think you should have access, contact your Project Nova coordinator.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 px-4 py-16 sm:px-6"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-8 text-base-content/60"
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-prose text-base leading-relaxed text-base-content/80">
        {description}
      </p>
    </section>
  );
}
