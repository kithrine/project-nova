import Link from "next/link";

import type { ActivationView } from "@/server/services/placement-service";

/**
 * The Blocker List (Story 5.5) in the workspace's blockers-and-actions
 * region: exactly the unmet activation prerequisites, each named per
 * docs/product/placement-lifecycle.md with a plain-language action linked
 * to the tab or surface that resolves it. Severity is text + icon, never
 * color alone; the region is a polite live region so resolution is
 * announced to assistive technology. Links only navigate — every
 * resolving control stays independently permission-gated where it lives.
 */
export function ActivationBlockers({ activation }: { activation: ActivationView }) {
  return (
    <section aria-live="polite" className="flex max-w-prose flex-col gap-2">
      {activation.open.length === 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-success/40 bg-success/5 px-4 py-3 text-sm"
        >
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
          <span>
            <span className="font-semibold">All activation prerequisites are met.</span>{" "}
            Nothing blocks this placement from activating.
          </span>
        </p>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-warning"
            >
              <path d="M12 3 2.5 19.5h19L12 3Z" />
              <path d="M12 10v4" />
              <path d="M12 17.5v.5" />
            </svg>
            Activation blockers
          </h2>
          <p className="text-sm text-base-content/70">
            This placement can&apos;t activate until each item below is resolved.
          </p>
          <ul aria-label="Activation blockers" className="flex flex-col gap-2">
            {activation.open.map((item) => (
              <li
                key={item.key}
                className="flex flex-col gap-0.5 rounded-md border border-warning/40 bg-warning/5 px-4 py-3"
              >
                <p className="text-sm font-medium">Open — {item.title}</p>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-sm underline underline-offset-2"
                  >
                    {item.action}
                  </Link>
                ) : (
                  <p className="text-sm text-base-content/80">{item.action}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
