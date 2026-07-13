import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { CompatibilityPanel } from "@/features/matching/compatibility-panel";
import { CreateDraftButton } from "@/features/matching/create-draft-button";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import { draftCreationBlockReason } from "@/server/domain/placement-match";
import { NON_TERMINAL_MATCH_STATUSES } from "@/server/domain/matching-queue";
import { NotFoundError } from "@/server/errors/app-error";
import { evaluatePairingCompatibility } from "@/server/services/matching-service";

export const metadata = { title: "Review Pairing" };

/**
 * The pairing review route (Stories 4.1/4.2): the Match Compatibility
 * Panel for one participant × shelter-site pair — categorical and
 * explainable, evaluated live server-side. Coordinator decision support
 * only; 4.3 adds "create a draft" from here.
 */
export default async function ReviewPairingPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollmentId?: string; siteId?: string }>;
}) {
  const ctx = await getAuthContext();
  if (
    !ctx ||
    !hasPermission(ctx, "placementMatch.viewQueue") ||
    !hasPermission(ctx, "placementMatch.viewCompatibility") ||
    !hasNovaScope(ctx)
  ) {
    return <PermissionDenied />;
  }

  const { enrollmentId, siteId } = await searchParams;
  if (!enrollmentId || !siteId) notFound();

  let evaluation;
  try {
    evaluation = await evaluatePairingCompatibility(ctx, enrollmentId, siteId);
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
          / Review pairing
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {evaluation.header.participantName} × {evaluation.header.organizationName} —{" "}
          {evaluation.header.siteName}
        </h1>
        <p className="text-sm text-base-content/70">
          Site capacity {evaluation.header.siteCapacity} · Reviewing compatibility before
          drafting a match (4.3).
        </p>
      </div>

      <CompatibilityPanel result={evaluation.result} />

      {await (async () => {
        const enrollment = await prisma.programEnrollment.findUnique({
          where: { id: enrollmentId },
          select: { status: true, participantId: true },
        });
        if (!enrollment) return null;
        const existing = await prisma.placementMatch.count({
          where: {
            participantId: enrollment.participantId,
            status: { in: [...NON_TERMINAL_MATCH_STATUSES] },
          },
        });
        const blocked = draftCreationBlockReason({
          enrollmentStatus: enrollment.status,
          hasNonTerminalMatch: existing > 0,
          hasBlockingPlacement: false,
        });
        if (blocked) {
          // The Blocked screen state (wireframe-spec): named in plain language.
          return (
            <div className="max-w-prose rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
              <p className="text-sm font-medium">A draft can&apos;t be created</p>
              <p className="mt-1 text-sm text-base-content/80">{blocked}</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-2 border-t border-base-300 pt-4">
            <p className="max-w-prose text-sm text-base-content/70">
              Ready to assemble this pairing? A draft stays coordinator-internal
              until you propose it (4.4).
            </p>
            <CreateDraftButton enrollmentId={enrollmentId} siteId={siteId} />
          </div>
        );
      })()}
    </section>
  );
}
