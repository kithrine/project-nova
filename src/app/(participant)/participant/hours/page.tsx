import { PageHeader } from "@/components/ui/page-header";
import { WeeklyHoursCard } from "@/features/timesheets/weekly-hours-card";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOrCreateOwnTimesheet } from "@/server/services/timesheet-service";

export const metadata = { title: "My Hours" };

/**
 * My Hours (Story 6.1; information-architecture.md): opening a week
 * get-or-creates the participant's own DRAFT timesheet — idempotent,
 * ownership resolved server-side, ACTIVE placements only for new weeks.
 */
export default async function MyHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await getOrProvisionAuthContext();
  const { week } = await searchParams;
  const view = ctx ? await getOrCreateOwnTimesheet(ctx, week) : null;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="My Hours" />
      {view?.week ? (
        <WeeklyHoursCard week={view.week} siteName={view.siteName} />
      ) : (
        <p className="max-w-prose rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          Recording hours opens once your placement is active. Your coordinator
          can tell you more about what happens next.
        </p>
      )}
    </section>
  );
}
