import { redirect } from "next/navigation";

import { ParticipantTasks } from "@/features/enrollment/participant-tasks";
import { ReadinessCard } from "@/features/enrollment/readiness-card";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { getOwnOnboardingSummary } from "@/server/services/enrollment-service";
import { getOwnReadiness } from "@/server/services/readiness-service";
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
  const readiness = ctx && person ? await getOwnReadiness(ctx) : null;
  // While the tasks card below is the actionable checklist, the readiness
  // card lists only what it DOESN'T cover — no duplicate rows (Story 3.6).
  const readinessForCard =
    readiness && trainingJourney?.stage === "ONBOARDING"
      ? { ...readiness, items: readiness.items.filter((item) => item.kind !== "task") }
      : readiness;

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
            <>
              <ParticipantTasks summary={onboarding} />
              {readinessForCard && !readinessForCard.ready &&
              readinessForCard.items.length > 0 ? (
                <ReadinessCard readiness={readinessForCard} />
              ) : null}
            </>
          ) : readinessForCard ? (
            // Training and beyond: the live path-to-matching card — named
            // outstanding items across training and certifications, or the
            // ready state (Story 3.6, AC5).
            <ReadinessCard readiness={readinessForCard} />
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
