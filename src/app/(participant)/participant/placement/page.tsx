import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPlacement } from "@/server/services/placement-service";

export const metadata = { title: "My Placement" };

/**
 * "My Placement" (Story 5.1 AC3): the participant's own placement in
 * plain, respectful language — no case notes, no internal blocker codes,
 * no one else's data. Ownership-scoped in the service; there is nothing
 * to filter here because restricted content never enters this view model.
 */
export default async function MyPlacementPage() {
  const ctx = await getOrProvisionAuthContext();
  const placement = ctx ? await getOwnPlacement(ctx) : null;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">My Placement</h1>
      {placement ? (
        <div className="flex max-w-prose flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-5">
            <p role="status" className="text-sm font-medium">
              {placement.stageLabel}
            </p>
            <p className="text-sm leading-relaxed text-base-content/80">
              {placement.stageBody}
            </p>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium">Where:</dt>
              <dd className="text-base-content/80">
                {placement.organizationName} — {placement.siteName}
                {placement.siteLocation ? `, ${placement.siteLocation}` : ""}
              </dd>
            </div>
            {placement.supervisorName ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">Your supervisor:</dt>
                <dd className="text-base-content/80">{placement.supervisorName}</dd>
              </div>
            ) : null}
            {placement.scheduleSummary ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">Schedule:</dt>
                <dd className="text-base-content/80">{placement.scheduleSummary}</dd>
              </div>
            ) : null}
            {placement.startDateLabel ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">Planned start:</dt>
                <dd className="text-base-content/80">{placement.startDateLabel}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium">Reference:</dt>
              <dd className="text-base-content/80">{placement.placementNumber}</dd>
            </div>
          </dl>
          <p className="text-sm text-base-content/70">
            Questions about any of this? Your coordinator is glad to walk
            through it with you.
          </p>
        </div>
      ) : (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          You don&apos;t have a placement yet. When a placement is set up for
          you, everything about it — where, when, and who to ask for — appears
          here.
        </p>
      )}
    </section>
  );
}
