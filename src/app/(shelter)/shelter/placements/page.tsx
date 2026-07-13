import Link from "next/link";

import { getAuthContext } from "@/server/auth/context";
import { listShelterPlacements } from "@/server/services/placement-service";

export const metadata = { title: "Placements" };

/**
 * The shelter's placements list (Story 5.1): organization scope via
 * hostOrganizationId — other shelters' placements are structurally
 * absent. Non-shelter viewers see the empty shell, matching the
 * dashboard's approvals pattern.
 */
export default async function ShelterPlacementsPage() {
  const ctx = await getAuthContext();
  let placements: Awaited<ReturnType<typeof listShelterPlacements>> = [];
  if (ctx) {
    try {
      placements = await listShelterPlacements(ctx);
    } catch {
      placements = [];
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Placements</h1>
      {placements.length === 0 ? (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No placements at your organization yet. Approved matches become
          placements, and they appear here as they are prepared and activated.
        </p>
      ) : (
        <ul aria-label="Placements at your organization" className="flex max-w-2xl flex-col gap-2">
          {placements.map((placement) => (
            <li key={placement.id}>
              <Link
                href={`/shelter/placements/${placement.id}`}
                className="flex flex-col gap-1 rounded-md border border-base-300 bg-base-100 px-4 py-3 transition-colors hover:bg-base-200"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{placement.participantName}</span>
                  <span className="text-xs font-medium text-base-content/70">
                    {placement.statusLabel}
                  </span>
                </span>
                <span className="text-xs text-base-content/60">
                  {placement.placementNumber} · {placement.siteName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
