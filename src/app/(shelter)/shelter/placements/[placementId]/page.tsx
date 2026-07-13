import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import {
  PlacementWorkspace,
  resolveTab,
} from "@/features/placement/placement-workspace";
import { getAuthContext } from "@/server/auth/context";
import { AuthorizationError, NotFoundError } from "@/server/errors/app-error";
import { getPlacementWorkspace } from "@/server/services/placement-service";

export const metadata = { title: "Placement" };

/**
 * The shelter-side placement workspace (Story 5.1): same service, shelter-
 * shaped view — no Case Notes tab, no internal-only fields, and a
 * cross-organization request is denied with no placement data in the
 * response (AC2/AC5).
 */
export default async function ShelterPlacementPage({
  params,
  searchParams,
}: {
  params: Promise<{ placementId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  const { placementId } = await params;
  const { tab } = await searchParams;

  let view;
  try {
    view = await getPlacementWorkspace(ctx, placementId);
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-base-content/60">
        <Link href="/shelter/placements" className="underline underline-offset-2">
          Placements
        </Link>{" "}
        / {view.placementNumber}
      </p>
      <PlacementWorkspace
        view={view}
        activeTab={resolveTab(view, tab)}
        basePath={`/shelter/placements/${placementId}`}
      />
    </div>
  );
}
