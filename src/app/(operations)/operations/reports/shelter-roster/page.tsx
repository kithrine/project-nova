import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ShelterRoster } from "@/features/reports/shelter-roster";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { getShelterRoster } from "@/server/services/reporting-service";

export const metadata = { title: "Shelter roster" };

/**
 * The Shelter Roster report (Story 7.3): every participating host
 * organization with sites, capacity, active-placement counts, and staff
 * contacts. Read-only, organization-level data only.
 */
export default async function ShelterRosterReportPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  let view;
  try {
    view = await getShelterRoster(ctx);
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    throw error;
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
          title="Shelter roster"
          description="Participating shelters with their sites, configured capacity, current active placements, and staff contacts."
        />
      </header>

      <ShelterRoster view={view} />
    </section>
  );
}
