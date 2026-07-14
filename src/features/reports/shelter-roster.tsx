import type { ShelterRosterView } from "@/server/services/reporting-service";

/**
 * Shelter roster (Story 7.3) — shared by the Operations report page and
 * the Shelter Manager's Organization page (which the service scopes to
 * their own organization). Organization-level data only: capacity versus
 * active count is always shown numerically (zero included — empty
 * capacity is the roster's most useful signal), status is text, and the
 * layout is mobile-first cards that stay cards on desktop (one card per
 * shelter reads better than a wide table for nested site rows).
 */

export function ShelterRoster({ view }: { view: ShelterRosterView }) {
  if (view.organizations.length === 0) {
    return (
      <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        No participating shelters yet. Host organizations appear here once they
        join the pilot.
      </p>
    );
  }

  return (
    <ul aria-label="Participating shelters" className="flex max-w-3xl flex-col gap-3">
      {view.organizations.map((organization) => (
        <li
          key={organization.organizationId}
          className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{organization.name}</h2>
            <p className="text-sm text-base-content/70">
              {organization.activePlacementCount} active of {organization.totalCapacity}{" "}
              capacity
            </p>
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium">Shelter Manager:</dt>
              <dd className="text-base-content/80">
                {organization.managers.length === 0
                  ? "Not assigned"
                  : organization.managers
                      .map((manager) => `${manager.name} (${manager.email})`)
                      .join(", ")}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium">Supervisors:</dt>
              <dd className="text-base-content/80">
                {organization.supervisorNames.length === 0
                  ? "None assigned"
                  : organization.supervisorNames.join(", ")}
              </dd>
            </div>
          </dl>

          {organization.sites.length === 0 ? (
            <p className="text-sm text-base-content/60">No sites configured yet.</p>
          ) : (
            <ul
              aria-label={`Sites at ${organization.name}`}
              className="flex flex-col gap-1.5"
            >
              {organization.sites.map((site) => (
                <li
                  key={site.siteId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{site.name}</span>
                  <span className="text-base-content/70">
                    {site.activePlacementCount} active / capacity {site.capacity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
