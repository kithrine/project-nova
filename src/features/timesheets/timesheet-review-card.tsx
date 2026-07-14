import { ApproveTimesheetPanel } from "@/features/timesheets/approve-timesheet-panel";
import { RejectTimesheetPanel } from "@/features/timesheets/reject-timesheet-panel";
import type { TimesheetReviewView } from "@/server/services/timesheet-service";

/**
 * The Timesheet Review Card (Story 6.5; component-guidelines.md): the
 * week's entries and total, read-only — only the participant edits
 * entries (6.2) — with the explicit Approve action for viewers whose
 * standing passed the canonical four-part check server-side. Status is
 * text-and-icon-free plain text, never color alone.
 */
export function TimesheetReviewCard({ review }: { review: TimesheetReviewView }) {
  return (
    <section className="flex max-w-lg flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold">
          {review.participantName} — {review.weekLabel}
        </h2>
        <p className="text-sm text-base-content/70">
          {review.placementNumber} · {review.siteName}
        </p>
        <p role="status" className="text-sm">
          Status: <span className="font-medium">{review.statusLabel}</span>
          {review.submittedAtLabel ? ` · submitted ${review.submittedAtLabel}` : ""}
        </p>
        {review.approvedAtLabel ? (
          <p className="text-sm text-base-content/70">
            Approved by {review.approvedByName} · {review.approvedAtLabel}
          </p>
        ) : null}
        {review.rejectionReason ? (
          <p className="text-sm text-base-content/70">
            Correction requested by {review.rejectedByName}
            {review.rejectedAtLabel ? ` · ${review.rejectedAtLabel}` : ""}:{" "}
            {review.rejectionReason}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-5">
        {review.days.filter((day) => day.entries.length > 0).length === 0 ? (
          <p className="text-sm text-base-content/70">
            No entries were recorded for this week.
          </p>
        ) : (
          review.days
            .filter((day) => day.entries.length > 0)
            .map((day) => (
              <section key={day.dateIso} className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{day.dayLabel}</h3>
                <ul className="flex flex-col gap-1">
                  {day.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-0.5 rounded-md border border-base-300 px-3 py-2"
                    >
                      <p className="text-sm tabular-nums">
                        {entry.startTime}–{entry.endTime}
                        {entry.breakMinutes > 0
                          ? ` · ${entry.breakMinutes} min break`
                          : ""}{" "}
                        · <span className="font-medium">{entry.hours} hours</span>
                      </p>
                      {entry.note ? (
                        <p className="text-xs text-base-content/70">{entry.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))
        )}
        <p className="border-t border-base-300 pt-2 text-sm">
          Week total:{" "}
          <span className="font-medium tabular-nums">{review.totalHours}</span> hours
        </p>
      </div>

      {review.viewerCanApprove || review.viewerCanReject ? (
        <div className="flex flex-col gap-2">
          {review.viewerCanApprove ? (
            <ApproveTimesheetPanel timesheetId={review.timesheetId} />
          ) : null}
          {review.viewerCanReject ? (
            <RejectTimesheetPanel timesheetId={review.timesheetId} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
