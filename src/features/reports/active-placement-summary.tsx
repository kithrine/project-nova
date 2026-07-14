import Link from "next/link";

import type {
  ActivePlacementSummaryRow,
  ActivePlacementSummaryView,
  SummarySortKey,
} from "@/server/services/reporting-service";

/**
 * Active Placement Summary (Story 7.1) — a read-only report over
 * in-progress placements. Filters are a plain GET form (no client
 * JavaScript); sortable column headers are links that re-render the
 * server component. Mobile-first: stacked cards at small viewports, a
 * denser semantic table from md up (ux-spec.md). Stage always renders
 * as text beside an SVG icon — never color alone.
 */

const SORTABLE_COLUMNS: ReadonlyArray<{ key: SummarySortKey; label: string }> = [
  { key: "participant", label: "Participant" },
  { key: "organization", label: "Host organization" },
  { key: "stage", label: "Stage" },
  { key: "start", label: "Start date" },
];

function sortHref(view: ActivePlacementSummaryView, basePath: string, key: SummarySortKey) {
  const params = new URLSearchParams();
  if (view.applied.organizationId) params.set("organizationId", view.applied.organizationId);
  if (view.applied.stage) params.set("stage", view.applied.stage);
  if (view.applied.coordinatorUserId) {
    params.set("coordinatorUserId", view.applied.coordinatorUserId);
  }
  params.set("sort", key);
  if (view.applied.sort === key && view.applied.direction === "asc") {
    params.set("direction", "desc");
  }
  return `${basePath}?${params.toString()}`;
}

function StageIndicator({ row }: { row: ActivePlacementSummaryRow }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StageIcon stage={row.stage} />
      <span>{row.stageLabel}</span>
    </span>
  );
}

/** Decorative (aria-hidden) — the stage label text always accompanies it. */
function StageIcon({ stage }: { stage: ActivePlacementSummaryRow["stage"] }) {
  const shared = {
    className: "size-4 shrink-0",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    "aria-hidden": true,
  } as const;
  if (stage === "ONBOARDING") {
    return (
      <svg {...shared}>
        <circle cx="8" cy="8" r="6" strokeDasharray="3 2.4" />
        <path d="M8 5.5v3l2 1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (stage === "PAUSED") {
    return (
      <svg {...shared}>
        <circle cx="8" cy="8" r="6" />
        <path d="M6.4 5.8v4.4M9.6 5.8v4.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.4 8.2 7.2 10l3.4-3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ActivePlacementSummary({
  view,
  basePath,
}: {
  view: ActivePlacementSummaryView;
  basePath: string;
}) {
  const filtersApplied = Boolean(
    view.applied.organizationId || view.applied.stage || view.applied.coordinatorUserId,
  );

  return (
    <div className="flex flex-col gap-5">
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-end gap-3 rounded-md border border-base-300 bg-base-200/40 p-3"
        aria-label="Report filters"
      >
        {view.novaScope && (
          <label className="flex flex-col gap-1 text-xs font-medium">
            Host organization
            <select
              name="organizationId"
              defaultValue={view.applied.organizationId ?? ""}
              className="select select-bordered select-sm min-w-44"
            >
              <option value="">All organizations</option>
              {view.organizationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium">
          Lifecycle stage
          <select
            name="stage"
            defaultValue={view.applied.stage ?? ""}
            className="select select-bordered select-sm min-w-36"
          >
            <option value="">All stages</option>
            {view.stageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {view.novaScope && (
          <label className="flex flex-col gap-1 text-xs font-medium">
            Coordinator
            <select
              name="coordinatorUserId"
              defaultValue={view.applied.coordinatorUserId ?? ""}
              className="select select-bordered select-sm min-w-40"
            >
              <option value="">All coordinators</option>
              {view.coordinatorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary btn-sm">
            Apply filters
          </button>
          {filtersApplied && (
            <Link href={basePath} className="text-sm underline underline-offset-2">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-base-content/70">
        {view.count === 1
          ? "1 in-progress placement"
          : `${view.count} in-progress placements`}
      </p>

      {view.rows.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          {filtersApplied
            ? "No placements match these filters."
            : "No in-progress placements yet. Placements appear here once they reach onboarding."}
        </p>
      ) : (
        <>
          {/* Small viewports: stacked cards. */}
          <ul aria-label="In-progress placements" className="flex flex-col gap-2 md:hidden">
            {view.rows.map((row) => (
              <li
                key={row.placementId}
                className="flex flex-col gap-1 rounded-md border border-base-300 bg-base-100 px-4 py-3"
              >
                <p className="text-sm font-medium">{row.participantName}</p>
                <p className="text-xs text-base-content/60">
                  {row.organizationName} — {row.siteName}
                </p>
                <p className="text-xs text-base-content/60">
                  Supervisor: {row.supervisorName ?? "Not assigned"} · Coordinator:{" "}
                  {row.coordinatorName ?? "Not assigned"}
                </p>
                <p className="text-xs">
                  <StageIndicator row={row} />
                  {row.startDateLabel && (
                    <span className="text-base-content/60"> · started {row.startDateLabel}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {/* md and up: the denser data table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.slice(0, 2).map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      view={view}
                      basePath={basePath}
                    />
                  ))}
                  <th scope="col">Site</th>
                  <th scope="col">Supervisor</th>
                  <th scope="col">Coordinator</th>
                  {SORTABLE_COLUMNS.slice(2).map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      view={view}
                      basePath={basePath}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.placementId}>
                    <td className="font-medium">{row.participantName}</td>
                    <td>{row.organizationName}</td>
                    <td>{row.siteName}</td>
                    <td>{row.supervisorName ?? "Not assigned"}</td>
                    <td>{row.coordinatorName ?? "Not assigned"}</td>
                    <td>
                      <StageIndicator row={row} />
                    </td>
                    <td>{row.startDateLabel ?? "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  column,
  view,
  basePath,
}: {
  column: { key: SummarySortKey; label: string };
  view: ActivePlacementSummaryView;
  basePath: string;
}) {
  const isActive = view.applied.sort === column.key;
  const ariaSort = isActive
    ? view.applied.direction === "asc"
      ? "ascending"
      : "descending"
    : undefined;
  return (
    <th scope="col" aria-sort={ariaSort}>
      <Link
        href={sortHref(view, basePath, column.key)}
        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
      >
        {column.label}
        {isActive && (
          <span aria-hidden className="text-base-content/60">
            {view.applied.direction === "asc" ? "↑" : "↓"}
          </span>
        )}
      </Link>
    </th>
  );
}
