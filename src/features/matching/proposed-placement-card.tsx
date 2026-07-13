import type {
  ProposedMatchParticipantView,
  ShelterApprovalView,
} from "@/server/services/matching-service";

/**
 * Proposed Placement Card (Story 4.4; docs/ux/component-guidelines.md) in
 * its two role shapes. Participant: warm, plain language, their own match
 * only. Shelter: the Placement approvals row with the operational details.
 * Neither shape ever includes coordinator notes, compatibility reads, or
 * restricted content — those fields are structurally absent from the view
 * models, not filtered here.
 */

function CardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-6 shrink-0 text-primary"
    >
      <path d="M4 8h16v11H4z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M4 13h16" />
    </svg>
  );
}

export function ParticipantProposedCard({
  match,
}: {
  match: ProposedMatchParticipantView;
}) {
  return (
    <section
      aria-labelledby="proposed-placement-heading"
      className="flex max-w-prose flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-5"
    >
      <p role="status" className="sr-only">
        A placement has been proposed for you.
      </p>
      <div className="flex items-start gap-3">
        <CardIcon />
        <div className="flex flex-col gap-1">
          <h2 id="proposed-placement-heading" className="text-lg font-semibold">
            A placement has been proposed for you
          </h2>
          <p className="text-base leading-relaxed text-base-content/80">
            {match.organizationName} — {match.siteName}
            {match.siteLocation ? `, ${match.siteLocation}` : ""}. Transitional
            employment supporting animal care.
          </p>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        {match.schedule ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Schedule:</dt>
            <dd className="text-base-content/80">{match.schedule}</dd>
          </div>
        ) : null}
        {match.startDateLabel ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Dates:</dt>
            <dd className="text-base-content/80">
              {match.startDateLabel}
              {match.endDateLabel ? ` – ${match.endDateLabel}` : ""}
            </dd>
          </div>
        ) : null}
        {match.respondByLabel ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Decision window:</dt>
            <dd className="text-base-content/80">through {match.respondByLabel}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-sm text-base-content/70">
        Take your time to think it over — recording your decision arrives here
        soon, and your coordinator is glad to talk it through with you anytime.
      </p>
    </section>
  );
}

export function ShelterApprovalCard({ match }: { match: ShelterApprovalView }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{match.participantName}</p>
        <p className="text-xs font-medium text-base-content/70">{match.statusLabel}</p>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
        <span>{match.siteName}</span>
        {match.supervisorName ? <span>Supervisor: {match.supervisorName}</span> : null}
        {match.schedule ? <span>Schedule: {match.schedule}</span> : null}
        {match.startDateLabel ? (
          <span>
            {match.startDateLabel}
            {match.endDateLabel ? ` – ${match.endDateLabel}` : ""}
          </span>
        ) : null}
        {match.respondByLabel ? <span>Respond by {match.respondByLabel}</span> : null}
      </p>
      <p className="text-xs text-base-content/60">
        Recording your decision arrives with the next update (Story 4.6).
      </p>
    </li>
  );
}
