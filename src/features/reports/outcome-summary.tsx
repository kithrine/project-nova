import Link from "next/link";

import { PlacementStatus } from "@/generated/prisma/client";
import type { OutcomeSummaryView } from "@/server/services/reporting-service";

/**
 * Outcome summary (Story 7.4): impact aggregates for funders and
 * stakeholders. Copy is respectful and plain (content-style-guide.md) —
 * terminal states are described neutrally, never as failure. Every count
 * renders as an icon-plus-text card; color never carries the meaning.
 */

const OUTCOME_DESCRIPTIONS: Record<PlacementStatus, string> = {
  [PlacementStatus.COMPLETED]: "Placements that reached their planned end.",
  [PlacementStatus.CONVERTED_TO_PERMANENT]:
    "Participants hired into permanent roles.",
  [PlacementStatus.WITHDRAWN]: "Participants who chose to step away.",
  [PlacementStatus.TERMINATED]: "Placements ended by Nova Operations.",
} as Record<PlacementStatus, string>;

const OUTCOME_ICONS: Record<string, React.ReactNode> = {
  [PlacementStatus.COMPLETED]: (
    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  [PlacementStatus.CONVERTED_TO_PERMANENT]: (
    <path
      d="M5 5V3.5A1.5 1.5 0 016.5 2h3A1.5 1.5 0 0111 3.5V5m-8.5 0h11A1.5 1.5 0 0115 6.5v5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 11.5v-5A1.5 1.5 0 012.5 5z"
      strokeLinecap="round"
    />
  ),
  [PlacementStatus.WITHDRAWN]: (
    <path d="M10 4l-4 4 4 4M6 8h8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  [PlacementStatus.TERMINATED]: (
    <path d="M4 8h8" strokeLinecap="round" />
  ),
};

export function OutcomeSummaryReport({
  view,
  basePath,
}: {
  view: OutcomeSummaryView;
  basePath: string;
}) {
  const isEmpty = view.totalOutcomes === 0 && view.certificationsEarned === 0;

  return (
    <div className="flex flex-col gap-5">
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-end gap-3 rounded-md border border-base-300 bg-base-200/40 p-3"
        aria-label="Reporting period"
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input
            type="date"
            name="from"
            defaultValue={view.range?.fromIso ?? ""}
            className="input input-bordered input-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input
            type="date"
            name="to"
            defaultValue={view.range?.toIso ?? ""}
            className="input input-bordered input-sm"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply period
        </button>
        {view.range && (
          <Link href={basePath} className="text-xs underline underline-offset-2">
            View program to date
          </Link>
        )}
      </form>

      <p className="text-sm text-base-content/70">
        {view.range
          ? `Outcomes from ${view.range.fromLabel} through ${view.range.toLabel}.`
          : "Program to date."}
      </p>

      {isEmpty && (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No outcomes recorded in this period yet.
        </p>
      )}

      <ul
        aria-label="Outcome counts"
        className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {view.outcomes.map((outcome) => (
          <li
            key={outcome.status}
            className="flex flex-col gap-1 rounded-md border border-base-300 bg-base-100 px-4 py-3"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="size-4 shrink-0"
              >
                {OUTCOME_ICONS[outcome.status]}
              </svg>
              {outcome.label}
            </p>
            <p className="text-3xl font-bold tabular-nums">{outcome.count}</p>
            <p className="text-xs text-base-content/60">
              {OUTCOME_DESCRIPTIONS[outcome.status]}
            </p>
          </li>
        ))}
        <li className="flex flex-col gap-1 rounded-md border border-base-300 bg-base-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="size-4 shrink-0"
            >
              <circle cx="8" cy="6" r="3.5" />
              <path d="M5.5 9L4.5 14l3.5-2 3.5 2-1-5" strokeLinejoin="round" />
            </svg>
            Credentials earned
          </p>
          <p className="text-3xl font-bold tabular-nums">{view.certificationsEarned}</p>
          <p className="text-xs text-base-content/60">
            Certifications participants earned during the program.
          </p>
        </li>
      </ul>
    </div>
  );
}
