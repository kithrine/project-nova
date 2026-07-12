import { redirect } from "next/navigation";

import { ParticipantTasks } from "@/features/enrollment/participant-tasks";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { getOwnOnboardingSummary } from "@/server/services/enrollment-service";

export const metadata = { title: "Dashboard" };

/**
 * Participant dashboard (Stories 1.7/2.2/3.3). Applicants (no memberships)
 * who haven't completed account onboarding are sent there first. Once a
 * person is enrolled (3.1), their onboarding checklist and live progress
 * appear here — the Required tasks card (docs/ux/wireframes-layouts.md).
 */
export default async function ParticipantDashboardPage() {
  const ctx = await getOrProvisionAuthContext();
  const person = ctx ? await getOwnPerson(ctx) : null;

  // Pure applicants (no staff/participant membership) complete onboarding first.
  if (ctx && !person && ctx.memberships.length === 0) {
    redirect("/participant/onboarding");
  }

  const onboarding = ctx && person ? await getOwnOnboardingSummary(ctx) : null;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to Project Nova</h1>
      {onboarding ? (
        <>
          <p className="max-w-prose text-base leading-relaxed text-base-content/80">
            {person?.legalFirstName ? `${person.legalFirstName}, you` : "You"}&apos;re
            enrolled in {onboarding.programName}. These tasks get you ready for your
            placement — take them at your own pace, and ask your coordinator anytime.
          </p>
          <ParticipantTasks summary={onboarding} />
        </>
      ) : person ? (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          Thanks, {person.legalFirstName} — your account is set up. Head to{" "}
          <a
            href="/participant/application"
            className="font-medium underline underline-offset-2"
          >
            My Application
          </a>{" "}
          to start or continue your application.
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
