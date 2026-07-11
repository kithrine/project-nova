export const metadata = { title: "Operations Dashboard" };

/**
 * Operations dashboard placeholder (Story 1.7). Today's Work queues,
 * urgent blockers, and upcoming deadlines arrive with Epic 2 onward
 * (docs/ux/wireframes-layouts.md).
 */
export default function OperationsDashboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Operations workspace</h1>
      <p className="max-w-prose text-base leading-relaxed text-base-content/80">
        Today&apos;s Work, urgent blockers, and application queues will appear here as the
        case-management workflows are built.
      </p>
    </section>
  );
}
