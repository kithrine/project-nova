import { ShelterApprovalCard } from "@/features/matching/proposed-placement-card";
import { getAuthContext } from "@/server/auth/context";
import { listShelterApprovals } from "@/server/services/matching-service";

export const metadata = { title: "Shelter Dashboard" };

/**
 * Shelter dashboard (Stories 1.7/4.4). Placement approvals list proposed
 * matches for THIS shelter's organization only (resource scope =
 * hostOrganizationId; Drafts never appear). Timesheets and evaluations
 * arrive with Epics 5–6.
 */
export default async function ShelterDashboardPage() {
  const ctx = await getAuthContext();
  let approvals: Awaited<ReturnType<typeof listShelterApprovals>> = [];
  if (ctx) {
    try {
      approvals = await listShelterApprovals(ctx);
    } catch {
      // Not a shelter member (e.g. staff previewing) — show the empty shell.
      approvals = [];
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Shelter workspace</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Placement approvals</h2>
        {approvals.length === 0 ? (
          <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
            No proposed placements are waiting on your review right now. New
            proposals from Project Nova appear here.
          </p>
        ) : (
          <ul aria-label="Placement approvals" className="flex max-w-2xl flex-col gap-2">
            {approvals.map((match) => (
              <ShelterApprovalCard key={match.id} match={match} />
            ))}
          </ul>
        )}
      </div>

      <p className="max-w-prose text-sm text-base-content/60">
        Timesheets awaiting review and evaluations due arrive with later updates.
      </p>
    </section>
  );
}
