import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ExportPicker } from "@/features/reports/export-picker";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import { EXPORT_DEFINITIONS } from "@/server/services/export-service";

export const metadata = { title: "Exports" };

/**
 * Named exports (Story 7.5) — restricted to holders of report.export
 * under Nova scope (Grant Administrator, Nova Administrator). The Route
 * Handler re-authorizes every download; this page is the picker with
 * its confirmation step.
 */
export default async function ExportsPage() {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "report.export") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs">
          <Link href="/operations/reports" className="underline underline-offset-2">
            Reports
          </Link>
        </p>
        <PageHeader
          title="Exports"
          description="Named exports with fixed, approved field sets. Every download is recorded in the audit trail; files are generated on demand and never stored (ADR-021)."
        />
      </header>

      <ExportPicker definitions={EXPORT_DEFINITIONS} />
    </section>
  );
}
