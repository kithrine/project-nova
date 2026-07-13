import { PermissionDenied } from "@/components/feedback/permission-denied";
import { QueueCandidates, QueueHosts } from "@/features/matching/queue-lists";
import { getAuthContext } from "@/server/auth/context";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import Link from "next/link";

import { getMatchingQueue, listMatchWorklist } from "@/server/services/matching-service";
import { listPlacementRecords } from "@/server/services/placement-service";

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

  const [queue, worklist, records] = await Promise.all([
    getMatchingQueue(ctx),
    listMatchWorklist(ctx),
    listPlacementRecords(ctx),
  ]);
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
        <h2 className="text-lg font-semibold">Matches in progress</h2>
        {worklist.length === 0 ? (
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No matches in progress. Drafts you create from a pairing review appear
            here.
          </p>
        ) : (
          <ul aria-label="Matches in progress" className="flex max-w-3xl flex-col gap-2">
            {worklist.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium">{row.participantName}</p>
                  <p className="text-xs text-base-content/60">
                    {row.organizationName} — {row.siteName} ·{" "}
                    <span className="font-medium">{row.statusLabel}</span>
                  </p>
                </div>
                <Link
                  href={`/operations/placements/matches/${row.id}`}
                  className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
                >
                  Open match: {row.participantName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Placement records</h2>
        {records.length === 0 ? (
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No placements yet. Approving a match creates its placement record
            here.
          </p>
        ) : (
          <ul aria-label="Placement records" className="flex max-w-3xl flex-col gap-2">
            {records.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium">{record.participantName}</p>
                  <p className="text-xs text-base-content/60">
                    {record.placementNumber} · {record.organizationName} —{" "}
                    {record.siteName} ·{" "}
                    <span className="font-medium">{record.statusLabel}</span>
                  </p>
                </div>
                <Link
                  href={`/operations/placements/records/${record.id}`}
                  className="whitespace-nowrap text-sm font-medium underline underline-offset-2"
                >
                  Open placement: {record.participantName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Shelters with capacity</h2>
        <QueueHosts hosts={queue.hosts} />
      </div>
    </section>
  );
}
