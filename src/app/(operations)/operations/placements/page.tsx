import { PermissionDenied } from "@/components/feedback/permission-denied";
import { QueueCandidates, QueueHosts } from "@/features/matching/queue-lists";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { getMatchingQueue } from "@/server/services/matching-service";

export const metadata = { title: "Placements — Matching Queue" };

/**
 * The matching queue (Story 4.1) — the Placements area's coordinator
 * worklist: longest-waiting READY_FOR_MATCHING participants alongside host
 * sites with capacity. Selecting a pairing is a plain GET form into the
 * Match Compatibility Panel route (4.2) — no client JavaScript needed.
 */
export default async function PlacementsQueuePage() {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "placementMatch.viewQueue") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const queue = await getMatchingQueue(ctx);
  const siteOptions = queue.hosts.flatMap((host) =>
    host.sites.map((site) => ({
      id: site.id,
      label: `${host.name} — ${site.name} (capacity ${site.capacity})`,
    })),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Matching queue</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          Participants ready for matching, longest waiting first, alongside shelters
          with capacity. Reviewing a pairing opens its compatibility read.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Awaiting match</h2>
        <QueueCandidates candidates={queue.candidates} siteOptions={siteOptions} />
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Shelters with capacity</h2>
        <QueueHosts hosts={queue.hosts} />
      </div>
    </section>
  );
}
