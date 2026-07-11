import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { Button } from "@/components/ui/button";
import {
  deactivateFundingSourceAction,
  reactivateFundingSourceAction,
  updateFundingSourceAction,
} from "@/features/funding/actions";
import { FundingSourceForm } from "@/features/funding/funding-source-form";
import { hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors/app-error";
import { getFundingSource } from "@/server/services/funding-source-service";

export const metadata = { title: "Funding source" };

/** Funding-source detail: edit + explicit status transition (Story 1.8). */
export default async function FundingSourceDetailPage({
  params,
}: {
  params: Promise<{ fundingSourceId: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "funding.manage")) {
    return <PermissionDenied />;
  }

  const { fundingSourceId } = await params;

  let source;
  try {
    source = await getFundingSource(ctx, fundingSourceId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const updateAction = updateFundingSourceAction.bind(null, source.id);
  const deactivateAction = deactivateFundingSourceAction.bind(null, source.id);
  const reactivateAction = reactivateFundingSourceAction.bind(null, source.id);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{source.name}</h1>
        <p className="text-sm text-base-content/70">
          {source.kindLabel} · Status: {source.statusLabel}
        </p>
      </div>

      <FundingSourceForm
        action={updateAction}
        fundingSource={source}
        submitLabel="Save Changes"
      />

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Status</h2>
        {source.status === "ACTIVE" ? (
          <form action={deactivateAction} className="flex flex-col items-start gap-2">
            <p className="max-w-prose text-sm text-base-content/70">
              Deactivating makes this source unavailable for new funding assignments.
              Existing assignments and reporting history are preserved — nothing is deleted.
            </p>
            <Button type="submit" variant="danger">
              Deactivate Funding Source
            </Button>
          </form>
        ) : (
          <form action={reactivateAction} className="flex flex-col items-start gap-2">
            <p className="max-w-prose text-sm text-base-content/70">
              Reactivating makes this source selectable for new funding assignments again.
            </p>
            <Button type="submit" variant="secondary">
              Reactivate Funding Source
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
