import { PermissionDenied } from "@/components/feedback/permission-denied";
import { createFundingSourceAction } from "@/features/funding/actions";
import { FundingSourceForm } from "@/features/funding/funding-source-form";
import { FundingSourceList } from "@/features/funding/funding-source-list";
import { hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import { listFundingSources } from "@/server/services/funding-source-service";

export const metadata = { title: "Funding sources" };

/**
 * Funding-source administration (Story 1.8). Requires funding.manage —
 * the shell admits all Nova staff, but this page enforces the permission
 * server-side and renders Permission denied otherwise.
 */
export default async function FundingSourcesPage() {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "funding.manage")) {
    return <PermissionDenied />;
  }

  const sources = await listFundingSources(ctx);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Funding sources</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          The grants and contracts that fund placements. Each placement carries exactly one
          active funding assignment (ADR-010). Deactivated sources are preserved for history
          and reporting.
        </p>
      </div>

      <FundingSourceList sources={sources} />

      <div className="flex flex-col gap-4 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">New funding source</h2>
        <FundingSourceForm
          action={createFundingSourceAction}
          submitLabel="Create Funding Source"
        />
      </div>
    </section>
  );
}
