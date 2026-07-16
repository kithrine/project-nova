import type { AuditReviewView } from "@/server/services/audit-service";

/**
 * Audit review (Story 7.6): the privileged, filterable window onto the
 * append-only audit trail. Rows show actor, action code, and a subject
 * REFERENCE — never record contents. Mobile-first: stacked cards under
 * md, the table from md up; filters are a plain GET form.
 */

export function AuditReview({
  view,
  basePath,
}: {
  view: AuditReviewView;
  basePath: string;
}) {
  const truncated = view.totalCount > view.rows.length;

  return (
    <div className="flex flex-col gap-5">
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-end gap-3 rounded-md border border-base-300 bg-base-200/40 p-3"
        aria-label="Audit filters"
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          Actor
          <select
            name="actor"
            defaultValue={view.applied.actorUserId ?? ""}
            className="select select-bordered select-sm"
          >
            <option value="">All actors</option>
            {view.actorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Action
          <select
            name="action"
            defaultValue={view.applied.action ?? ""}
            className="select select-bordered select-sm"
          >
            <option value="">All actions</option>
            {view.actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Resource type
          <select
            name="subjectType"
            defaultValue={view.applied.subjectType ?? ""}
            className="select select-bordered select-sm"
          >
            <option value="">All resources</option>
            {view.subjectTypeOptions.map((subjectType) => (
              <option key={subjectType} value={subjectType}>
                {subjectType}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          From
          <input
            type="date"
            name="from"
            defaultValue={view.applied.fromIso ?? ""}
            className="input input-bordered input-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          To
          <input
            type="date"
            name="to"
            defaultValue={view.applied.toIso ?? ""}
            className="input input-bordered input-sm"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Apply filters
        </button>
      </form>

      <p className="text-sm text-base-content/70">
        {view.totalCount === 1
          ? "1 audit event"
          : `${view.totalCount} audit events`}
        {truncated ? ` — showing the ${view.rows.length} most recent` : ""}.
      </p>

      {view.rows.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No audit events match these filters.
        </p>
      ) : (
        <>
          {/* Small viewports: one card per event. */}
          <ul aria-label="Audit events" className="flex flex-col gap-2 md:hidden">
            {view.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-0.5 rounded-md border border-base-300 bg-base-100 px-4 py-3"
              >
                <p className="text-sm font-medium">{row.action}</p>
                <p className="text-xs">{row.actorName}</p>
                <p className="text-xs text-base-content/60">
                  {row.subjectType} · {row.subjectId}
                </p>
                {row.detail && <p className="text-xs">{row.detail}</p>}
                <p className="text-xs text-base-content/60">{row.atLabel}</p>
              </li>
            ))}
          </ul>

          {/* md and up: the audit table. */}
          {/* Focusable, labeled scroll region: keyboard users can scroll a
              wide table even when no row contains a focusable element. */}
          <div
            className="hidden overflow-x-auto md:block"
            tabIndex={0}
            role="region"
            aria-label="Audit events table"
          >
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{row.atLabel}</td>
                    <td>{row.actorName}</td>
                    <td className="font-mono text-xs">{row.action}</td>
                    <td>
                      {row.subjectType}
                      <span className="ml-1 font-mono text-xs text-base-content/60">
                        {row.subjectId}
                      </span>
                    </td>
                    <td>{row.detail ?? "—"}</td>
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
