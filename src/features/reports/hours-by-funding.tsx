import type { HoursByFundingView } from "@/server/services/reporting-service";

/**
 * Approved hours by funding source (Story 7.2) — ADR-020's provisional
 * pilot format, and it says so on its face: the provisional notice is
 * part of the report, not documentation. Finalized (LOCKED) hours and
 * approved-but-unlocked hours render as separate columns that are never
 * summed together. Mobile-first: stacked group cards under md, the
 * grouped table with a grand-total footer from md up.
 */

export function HoursByFundingReport({
  view,
  basePath,
}: {
  view: HoursByFundingView;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <aside
        role="note"
        aria-label="Provisional format notice"
        className="flex max-w-prose items-start gap-2.5 rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="mt-0.5 size-4 shrink-0"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v3.5M8 11h.01" strokeLinecap="round" />
        </svg>
        <p>
          <span className="font-semibold">Provisional pilot format.</span> The final
          reimbursement schema is pending validation against executed award documents
          (ADR-020) — do not submit these figures to a funder without that validation.
        </p>
      </aside>

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
            defaultValue={view.range.fromIso}
            className="input input-bordered input-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input
            type="date"
            name="to"
            defaultValue={view.range.toIso}
            className="input input-bordered input-sm"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply period
        </button>
      </form>

      <p className="text-sm text-base-content/70">
        Weeks starting {view.range.fromLabel} through {view.range.toLabel}
        {view.range.fromParams
          ? ""
          : " (current month)"}. Each week counts toward the period containing its
        Monday.
      </p>

      {view.groups.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No finalized or approved hours in this period.
        </p>
      ) : (
        <>
          {/* Small viewports: one card per funding source. */}
          <ul aria-label="Hours by funding source" className="flex flex-col gap-2 md:hidden">
            {view.groups.map((group) => (
              <li
                key={group.fundingSourceId ?? "unassigned"}
                className="flex flex-col gap-1 rounded-md border border-base-300 bg-base-100 px-4 py-3"
              >
                <p className="text-sm font-medium">{group.name}</p>
                {(group.kindLabel || group.code) && (
                  <p className="text-xs text-base-content/60">
                    {[group.kindLabel, group.code].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-xs">
                  Finalized: <span className="font-medium">{group.lockedHours} hours</span>{" "}
                  ({group.lockedTimesheetCount} weeks)
                </p>
                <p className="text-xs">
                  Approved, not yet finalized:{" "}
                  <span className="font-medium">{group.approvedHours} hours</span> (
                  {group.approvedTimesheetCount} weeks)
                </p>
                <p className="text-xs text-base-content/60">
                  {group.placementCount === 1
                    ? "1 placement"
                    : `${group.placementCount} placements`}
                </p>
              </li>
            ))}
          </ul>

          {/* md and up: the grouped table with a grand-total footer. */}
          <div
            className="hidden overflow-x-auto md:block"
            tabIndex={0}
            role="region"
            aria-label="Hours by funding source table"
          >
            <table className="table table-sm w-full">
              {/* Teal header band (docs/ux/component-guidelines.md data-table recipe). */}
              <thead className="bg-primary text-primary-content">
                <tr>
                  <th scope="col">Funding source</th>
                  <th scope="col">Award code</th>
                  <th scope="col" className="text-right">
                    Finalized hours
                  </th>
                  <th scope="col" className="text-right">
                    Approved, not finalized
                  </th>
                  <th scope="col" className="text-right">
                    Placements
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.groups.map((group) => (
                  <tr key={group.fundingSourceId ?? "unassigned"}>
                    <td className="font-medium">
                      {group.name}
                      {group.kindLabel && (
                        <span className="ml-2 text-xs font-normal text-base-content/60">
                          {group.kindLabel}
                        </span>
                      )}
                    </td>
                    <td>{group.code ?? "—"}</td>
                    <td className="text-right tabular-nums">{group.lockedHours}</td>
                    <td className="text-right tabular-nums">{group.approvedHours}</td>
                    <td className="text-right tabular-nums">{group.placementCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="text-left">
                    All funding sources
                  </th>
                  <td className="text-right font-semibold tabular-nums">
                    {view.totalLockedHours}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {view.totalApprovedHours}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
