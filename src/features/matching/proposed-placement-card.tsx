import { ParticipantDecisionControls } from "@/features/matching/participant-decision-controls";
import { ShelterDecisionControls } from "@/features/matching/shelter-decision-controls";
import type {
  DeclinedPlacementNotice,
  ProposedMatchParticipantView,
  ShelterApprovalView,
} from "@/server/services/matching-service";

/**
 * Proposed Placement Card (Story 4.4; docs/ux/component-guidelines.md) in
 * its two role shapes. Participant: warm, plain language, their own match
 * only — with the Accept/Decline decision controls while their track is
 * pending (Story 4.5) and the accepted waiting state after. Shelter: the
 * Placement approvals row with the operational details. Neither shape ever
 * includes coordinator notes, compatibility reads, or restricted content —
 * those fields are structurally absent from the view models, not filtered
 * here.
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
  const accepted = match.participantDecision === "ACCEPTED";

  return (
    <section
      aria-labelledby="proposed-placement-heading"
      className="flex max-w-prose flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-5"
    >
      <p role="status" className="sr-only">
        {accepted
          ? "You accepted this placement."
          : "A placement has been proposed for you."}
      </p>
      <div className="flex items-start gap-3">
        <CardIcon />
        <div className="flex flex-col gap-1">
          <h2 id="proposed-placement-heading" className="text-lg font-semibold">
            {accepted
              ? "You accepted this placement"
              : "A placement has been proposed for you"}
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
        {!accepted && match.respondByLabel ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Decision window:</dt>
            <dd className="text-base-content/80">through {match.respondByLabel}</dd>
          </div>
        ) : null}
      </dl>
      {accepted ? (
        <p className="text-sm text-base-content/70">
          Wonderful — nothing more is needed from you right now. The shelter is
          reviewing it too, and Nova gives everything a final look before your
          start date is confirmed.
        </p>
      ) : (
        <>
          <p className="text-sm text-base-content/70">
            Take your time to think it over — this is your decision to make, and
            your coordinator is glad to talk it through with you anytime.
          </p>
          <ParticipantDecisionControls
            matchId={match.id}
            organizationName={match.organizationName}
          />
        </>
      )}
    </section>
  );
}

/**
 * The gentle post-decline notice (Story 4.5 UX): respectful, plain, and
 * time-boxed by the service — never "Rejected" or "Failed" language.
 */
export function ParticipantDeclinedNotice({
  notice,
}: {
  notice: DeclinedPlacementNotice;
}) {
  return (
    <section
      aria-labelledby="declined-placement-heading"
      className="flex max-w-prose flex-col gap-2 rounded-lg border border-base-300 bg-base-200/50 p-5"
    >
      <p role="status" className="sr-only">
        You declined this placement.
      </p>
      <h2 id="declined-placement-heading" className="text-lg font-semibold">
        You declined this placement
      </h2>
      <p className="text-sm leading-relaxed text-base-content/80">
        You declined the placement at {notice.organizationName} — that&apos;s
        okay, and it was yours to decide. You&apos;re still in the program, and
        you may be matched with another opportunity. Your coordinator is glad
        to talk anytime.
      </p>
    </section>
  );
}

export function ShelterApprovalCard({ match }: { match: ShelterApprovalView }) {
  const pending = match.shelterDecision === "PENDING";

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
      {!pending ? (
        <p className="flex items-center gap-1.5 text-xs text-base-content/70">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-success"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.5 2.5 4.5-5" />
          </svg>
          <span role="status">
            Your decision: {match.shelterDecisionLabel} — Nova completes the final
            review once the participant has also accepted.
          </span>
        </p>
      ) : match.viewerCanDecide ? (
        <ShelterDecisionControls matchId={match.id} />
      ) : (
        // The visible read-only state for Shelter Supervisor (AC4) — a calm
        // explanation, never a broken or missing action.
        <p className="text-xs text-base-content/60">
          Read-only — your Shelter Manager records the decision on proposals.
        </p>
      )}
    </li>
  );
}
