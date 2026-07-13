import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { CompatibilityPanel } from "@/features/matching/compatibility-panel";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
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
    </section>
  );
}
