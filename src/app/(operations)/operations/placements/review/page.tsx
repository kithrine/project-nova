import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";

export const metadata = { title: "Review Pairing" };

/**
 * The pairing review route (Story 4.1's entry point into 4.2): names the
 * selected participant × shelter site pair. The Match Compatibility Panel
 * itself arrives with Story 4.2 and renders here.
 */
export default async function ReviewPairingPage({
  searchParams,
}: {
  searchParams: Promise<{ enrollmentId?: string; siteId?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "placementMatch.viewQueue") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const { enrollmentId, siteId } = await searchParams;
  if (!enrollmentId || !siteId) notFound();

  const [enrollment, site] = await Promise.all([
    prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        participant: {
          include: { person: { select: { legalFirstName: true, legalLastName: true } } },
        },
      },
    }),
    prisma.organizationSite.findUnique({
      where: { id: siteId },
      include: { organization: { select: { name: true } } },
    }),
  ]);
  if (!enrollment || !site) notFound();

  const participantName = `${enrollment.participant.person.legalFirstName} ${enrollment.participant.person.legalLastName}`;

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
          {participantName} × {site.organization.name} — {site.name}
        </h1>
        <p className="text-sm text-base-content/70">
          Site capacity {site.capacity} · Reviewing compatibility before drafting a match.
        </p>
      </div>

      <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
        The Match Compatibility Panel arrives with Story 4.2 and renders the
        categorical, explainable read for this pairing here.
      </p>
    </section>
  );
}
