import type {
  QueueCandidateView,
  QueueHostView,
} from "@/server/services/matching-service";

/**
 * Matching-queue lists (Story 4.1; docs/ux/wireframes-layouts.md worklist
 * pattern). Server-safe presentational components: candidate state is
 * text + SVG icon (never color alone), pairing selection is a plain GET
 * form into the review route (no client JavaScript), and empty states are
 * explicit per docs/ux/wireframe-spec.md.
 */

export interface PairingSiteOption {
  id: string;
  label: string;
}

function StateBadge({ state }: { state: QueueCandidateView["state"] }) {
  if (state === "MATCH_IN_PROGRESS") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-base-content/70">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 text-secondary"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" />
        </svg>
        Match in progress
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-base-content/70">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-4 shrink-0 text-base-content/40"
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
      Awaiting match
    </p>
  );
}

export function QueueCandidates({
  candidates,
  siteOptions,
}: {
  candidates: QueueCandidateView[];
  siteOptions: PairingSiteOption[];
}) {
  if (candidates.length === 0) {
    return (
      <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        No participants are ready for matching right now. This list fills as
        enrollments reach Ready for Matching (Epic 3).
      </p>
    );
  }

  return (
    <ul aria-label="Participants awaiting match" className="flex max-w-3xl flex-col gap-2">
      {candidates.map((candidate) => (
        <li
          key={candidate.enrollmentId}
          className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium">{candidate.participantName}</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
                <span>{candidate.programName}</span>
                <span>
                  Ready since {candidate.readySinceLabel} ·{" "}
                  {candidate.waitingDays === 0
                    ? "today"
                    : `waiting ${candidate.waitingDays} day${candidate.waitingDays === 1 ? "" : "s"}`}
                </span>
                {candidate.availability ? (
                  <span>Availability: {candidate.availability}</span>
                ) : null}
              </p>
              {candidate.blockerLabels.length > 0 ? (
                <p className="flex items-start gap-1.5 text-xs text-base-content/70">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16.5h.01" />
                  </svg>
                  Re-emerged blockers: {candidate.blockerLabels.join("; ")}
                </p>
              ) : null}
            </div>
            <StateBadge state={candidate.state} />
          </div>

          {candidate.state === "AWAITING_MATCH" && siteOptions.length > 0 ? (
            <form
              action="/operations/placements/review"
              method="get"
              className="flex flex-wrap items-end gap-3 border-t border-base-300 pt-3"
            >
              <input type="hidden" name="enrollmentId" value={candidate.enrollmentId} />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`site-${candidate.enrollmentId}`}
                  className="text-sm font-medium"
                >
                  Candidate shelter site
                </label>
                <select
                  id={`site-${candidate.enrollmentId}`}
                  name="siteId"
                  required
                  className="rounded-md border border-base-300 px-3 py-2 text-sm"
                >
                  {siteOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90"
              >
                Review Pairing: {candidate.participantName}
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function QueueHosts({ hosts }: { hosts: QueueHostView[] }) {
  if (hosts.length === 0) {
    return (
      <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        No shelter sites currently have capacity. Capacity is configured during
        shelter onboarding (docs/ops/shelter-onboarding.md).
      </p>
    );
  }

  return (
    <ul aria-label="Shelters with capacity" className="flex max-w-3xl flex-col gap-2">
      {hosts.map((host) => (
        <li
          key={host.organizationId}
          className="rounded-md border border-base-300 bg-base-100 px-4 py-3"
        >
          <p className="text-sm font-medium">{host.name}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {host.sites.map((site) => (
              <li key={site.id} className="text-xs text-base-content/70">
                {site.name} — capacity {site.capacity}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
