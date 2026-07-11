export const metadata = { title: "Dashboard" };

/**
 * Participant dashboard placeholder (Story 1.7). The journey timeline,
 * Next Step card, and task list arrive with Epic 2
 * (docs/ux/wireframes-layouts.md).
 */
export default function ParticipantDashboardPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to Project Nova</h1>
      <p className="max-w-prose text-base leading-relaxed text-base-content/80">
        This is your home base. Your journey timeline and next steps will appear here as
        the program experience is built.
      </p>
    </section>
  );
}
