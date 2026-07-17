import { PermissionDenied } from "@/components/feedback/permission-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ShelterRoster } from "@/features/reports/shelter-roster";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { getShelterRoster } from "@/server/services/reporting-service";

export const metadata = { title: "Organization" };

/**
 * The shelter Organization page (Story 7.3; information-architecture.md):
 * the Shelter Manager's own-organization view of the roster — sites,
 * capacity, active placements, and staff. The service scopes the roster
 * to the member's organization; supervisors (who do not hold
 * reporting.view) see the Permission denied state.
 */
export default async function ShelterOrganizationPage() {
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
      <PageHeader
        title="Organization"
        description="Your organization's sites, capacity, current active placements, and staff."
      />

      <ShelterRoster view={view} />
    </section>
  );
}
