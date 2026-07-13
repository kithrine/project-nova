import type { OwnReadinessView } from "@/server/services/readiness-service";

/**
 * The participant's "path to matching" card (Story 3.6, AC5) — the same
 * readiness computation as the coordinator's Blocker List, in respectful
 * plain language: what's still ahead, never internal codes, never
 * color-only status, never judgmental phrasing.
 */

export function ReadinessCard({ readiness }: { readiness: OwnReadinessView }) {
  if (readiness.ready) {
    return (
      <section
        aria-labelledby="readiness-heading"
        className="flex max-w-prose flex-col gap-2 rounded-lg border border-success/30 bg-success/5 p-5"
      >
        <p role="status" className="sr-only">
          Current step: Ready for matching.
        </p>
        <h2 id="readiness-heading" className="flex items-center gap-2 text-lg font-semibold">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6 shrink-0 text-success"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.5 2.5 4.5-5" />
          </svg>
          You&apos;re ready for matching
        </h2>
        <p className="text-base leading-relaxed text-base-content/80">
          Every requirement is complete — wonderful work. Our team will take it from
          here and be in touch about placement matching.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="readiness-heading"
      className="flex max-w-prose flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-5"
    >
      <h2 id="readiness-heading" className="text-lg font-semibold">
        Your path to matching
      </h2>
      <p className="text-sm text-base-content/70">
        {readiness.items.length === 1
          ? "One thing left before we can start matching you with a shelter — no rush."
          : `${readiness.items.length} things left before we can start matching you with a shelter — at your own pace.`}
      </p>
      <ul className="flex flex-col gap-1.5">
        {readiness.items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-0.5 size-4 shrink-0 text-base-content/40"
            >
              <circle cx="12" cy="12" r="9" />
            </svg>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
