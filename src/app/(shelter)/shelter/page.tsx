export const metadata = { title: "Shelter Dashboard" };

/**
 * Shelter dashboard placeholder (Story 1.7). Placement approvals,
 * timesheets awaiting review, and evaluations due arrive with Epics 4–6
 * (docs/ux/wireframes-layouts.md).
 */
export default function ShelterDashboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Shelter workspace</h1>
      <p className="max-w-prose text-base leading-relaxed text-base-content/80">
        Placement approvals, timesheets awaiting review, and evaluations will appear here
        as those workflows are built.
      </p>
    </section>
  );
}
