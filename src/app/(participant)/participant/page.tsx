import { redirect } from "next/navigation";

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";

export const metadata = { title: "Dashboard" };

/**
 * Participant dashboard (Stories 1.7/2.2). Applicants (no memberships) who
 * haven't completed account onboarding are sent there first. The journey
 * timeline and Next Step card arrive with 2.3/2.6.
 */
export default async function ParticipantDashboardPage() {
  const ctx = await getOrProvisionAuthContext();
  const person = ctx ? await getOwnPerson(ctx) : null;

  // Pure applicants (no staff/participant membership) complete onboarding first.
  if (ctx && !person && ctx.memberships.length === 0) {
    redirect("/participant/onboarding");
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to Project Nova</h1>
      {person ? (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          Thanks, {person.legalFirstName} — your account is set up. Your application opens
          here as the next step in your journey.
        </p>
      ) : (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          This is your home base. Your journey timeline and next steps will appear here as
          the program experience is built.
        </p>
      )}
    </section>
  );
}
