import Link from "next/link";

import type { MyHoursWeekView } from "@/server/services/timesheet-service";

/**
 * The Weekly Hours Card (Story 6.1; component-guidelines.md): the
 * participant's primary My Hours surface. Mobile-first single column,
 * status stated in text (never color alone), keyboard-operable week
 * navigation via real links. Entry recording arrives with 6.2; this
 * story renders the ready, empty DRAFT week or the reason a week can't
 * hold a timesheet.
 */
export function WeeklyHoursCard({
  week,
  siteName,
}: {
  week: MyHoursWeekView;
  siteName: string | null;
}) {
  return (
    <section className="flex max-w-lg flex-col gap-4">
      <nav aria-label="Week navigation" className="flex items-center justify-between gap-2">
        <Link
          href={`/participant/hours?week=${week.previousWeekIso}`}
          className="rounded-md border border-base-300 px-3 py-1.5 text-sm underline-offset-2 hover:underline"
        >
          ← Previous week
        </Link>
        {week.nextWeekIso ? (
          <Link
            href={`/participant/hours?week=${week.nextWeekIso}`}
            className="rounded-md border border-base-300 px-3 py-1.5 text-sm underline-offset-2 hover:underline"
          >
            Next week →
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm text-base-content/50">
            This is the current week
          </span>
        )}
      </nav>

      <div className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold">{week.weekLabel}</h2>
          {siteName ? (
            <p className="text-sm text-base-content/70">Hours at {siteName}</p>
          ) : null}
        </div>

        {week.blockedReason ? (
          <p
            role="status"
            className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/80"
          >
            {week.blockedReason}
          </p>
        ) : (
          <>
            <p role="status" className="text-sm">
              Status: <span className="font-medium">{week.statusLabel}</span>
            </p>
            <p className="text-sm">
              Total hours this week:{" "}
              <span className="font-medium tabular-nums">{week.totalHours}</span>
            </p>
            {week.totalHours === "0.00" && week.editable ? (
              <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
                No hours recorded yet. Your timesheet for this week is ready —
                adding your work days arrives here next.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
