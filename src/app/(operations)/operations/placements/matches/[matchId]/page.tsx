import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { AssistedDecisionPanel } from "@/features/matching/assisted-decision-panel";
import { CompatibilityPanel } from "@/features/matching/compatibility-panel";
import { MatchDraftForm } from "@/features/matching/match-draft-form";
import { ProposePanel } from "@/features/matching/propose-panel";
import { proposalMissingFields } from "@/server/domain/placement-match";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { NotFoundError } from "@/server/errors/app-error";
import { getMatchWorkspace } from "@/server/services/matching-service";

export const metadata = { title: "Placement Match" };

/**
 * The match workspace (Story 4.3): draft details, the point-in-time
 * compatibility snapshot, and the withdraw action. Coordinator-internal —
 * drafts are never participant- or shelter-visible (AC6); proposing to
 * both parties arrives with Story 4.4.
 */
export default async function MatchWorkspacePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "placementMatch.manageDraft") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const { matchId } = await params;
  let match;
  try {
    match = await getMatchWorkspace(ctx, matchId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-base-content/60">
          <Link href="/operations/placements" className="underline underline-offset-2">
            Matching queue
          </Link>{" "}
          / Match
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {match.participantName} × {match.organizationName} — {match.siteName}
        </h1>
        <p className="text-sm text-base-content/70">
          Status: <span className="font-medium">{match.statusLabel}</span>
          {match.status === "DRAFT"
            ? " · Coordinator-internal until proposed (4.4)"
            : ""}
        </p>
      </div>

      {match.status === "DRAFT" ? (
        <>
          <MatchDraftForm match={match} />
          <ProposePanel
            matchId={match.id}
            missingFields={proposalMissingFields({
              proposedSupervisorId: match.supervisorId,
              proposedSchedule: match.schedule,
              proposedStartDate: match.startDateValue ? new Date(match.startDateValue) : null,
              proposedEndDate: match.endDateValue ? new Date(match.endDateValue) : null,
            })}
          />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {match.status !== "PROPOSED" ? (
            <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
              This match is {match.statusLabel.toLowerCase()} — draft editing is
              closed.
            </p>
          ) : null}
          <div className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-200/50 px-4 py-3">
            <h2 className="text-sm font-semibold">Decision tracks</h2>
            <p className="text-sm text-base-content/80">
              Participant decision:{" "}
              <span className="font-medium">{match.participantDecisionLabel}</span>
              {match.participantDecisionAtLabel
                ? ` · ${match.participantDecisionAtLabel}`
                : ""}
              {match.participantDecisionRecordedByStaff
                ? " · recorded by staff on the participant's behalf"
                : ""}
            </p>
            {match.participantDecisionNote ? (
              // Operations-visible only (4.5 AC6) — this note never enters
              // shelter or participant view models.
              <p className="text-sm text-base-content/70">
                Participant note: {match.participantDecisionNote}
              </p>
            ) : null}
            <p className="text-sm text-base-content/80">
              Shelter decision:{" "}
              <span className="font-medium">{match.shelterDecisionLabel}</span> —
              recorded from the shelter dashboard (4.6).
            </p>
          </div>
          {match.status === "PROPOSED" && match.participantDecision === "PENDING" ? (
            <AssistedDecisionPanel matchId={match.id} />
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Compatibility snapshot</h2>
        {match.snapshot ? (
          <>
            <p className="text-sm text-base-content/70">
              Point-in-time record from{" "}
              {new Date(match.snapshot.evaluatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC — re-evaluated on every draft save.
            </p>
            <CompatibilityPanel result={match.snapshot} />
          </>
        ) : (
          <p className="max-w-prose text-sm text-base-content/70">
            No compatibility snapshot is stored for this match.
          </p>
        )}
      </div>
    </section>
  );
}
