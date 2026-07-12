import { redirect } from "next/navigation";

import { ParticipantTasks } from "@/features/enrollment/participant-tasks";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { getOwnOnboardingSummary } from "@/server/services/enrollment-service";
import { getOwnTrainingJourney } from "@/server/services/training-service";

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
  const trainingJourney = ctx && person ? await getOwnTrainingJourney(ctx) : null;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to Project Nova</h1>
      {onboarding ? (
        <>
          <p className="max-w-prose text-base leading-relaxed text-base-content/80">
            {person?.legalFirstName ? `${person.legalFirstName}, you` : "You"}&apos;re enrolled
            in {onboarding.programName}. Your current step and next actions appear below, and
            you can ask your coordinator for support anytime.
          </p>
          {trainingJourney?.stage === "ONBOARDING" ? (
            <ParticipantTasks summary={onboarding} />
          ) : trainingJourney?.stage === "TRAINING" ? (
            <section
              aria-labelledby="training-step-heading"
              className="max-w-2xl rounded-lg border border-base-300 bg-base-100 p-5"
            >
              <p className="text-sm font-medium text-base-content/60">Current step</p>
              <h2 id="training-step-heading" className="mt-1 text-xl font-semibold">
                Training
              </h2>
              <p className="mt-2 text-sm text-base-content/80">
                Your coordinator is recording your required training.{" "}
                {trainingJourney.completedCount} of {trainingJourney.requiredCount} required
                programs are complete. No action is needed here right now.
              </p>
            </section>
          ) : trainingJourney?.stage === "TRAINING_COMPLETE" ? (
            <section
              aria-labelledby="training-complete-heading"
              className="max-w-2xl rounded-lg border border-success/40 bg-base-100 p-5"
            >
              <h2 id="training-complete-heading" className="text-xl font-semibold">
                Required training complete
              </h2>
              <p className="mt-2 text-sm text-base-content/80">
                Nova will confirm your remaining readiness items before matching. Site-specific
                orientation happens later for a proposed placement.
              </p>
            </section>
          ) : (
            <ParticipantTasks summary={onboarding} />
          )}
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
          This is your home base. Your journey timeline and next steps will appear here as the
          program experience is built.
        </p>
      )}
    </section>
  );
}
