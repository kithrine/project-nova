import { redirect } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icons";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonClassName } from "@/components/ui/button";
import { ParticipantTasks } from "@/features/enrollment/participant-tasks";
import { ReadinessCard } from "@/features/enrollment/readiness-card";
import {
  ParticipantDeclinedNotice,
  ParticipantProposedCard,
} from "@/features/matching/proposed-placement-card";
import { PlacementHomeTiles } from "@/features/placement/placement-home-tiles";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { getOwnCertifications } from "@/server/services/certification-service";
import { getOwnOnboardingSummary } from "@/server/services/enrollment-service";
import {
  getOwnDeclinedPlacementNotice,
  getOwnProposedMatch,
} from "@/server/services/matching-service";
import { getOwnPlacement } from "@/server/services/placement-service";
import { getOwnReadiness } from "@/server/services/readiness-service";
import { getOwnCurrentWeekHours } from "@/server/services/timesheet-service";
import { getOwnTrainingJourney } from "@/server/services/training-service";

export const metadata = { title: "Dashboard" };

/** Small hand-drawn spark beside the greeting (decorative, brand pass). */
function AccentSpark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <path d="M6.5 6.5 9 9M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" opacity="0.6" />
    </svg>
  );
}

/**
 * Participant dashboard (Stories 1.7/2.2/3.3; brand pass 2026-07-16).
 * Applicants (no memberships) who haven't completed account onboarding
 * are sent there first. Once a person is enrolled (3.1), their live
 * progress appears as stat tiles and the Required tasks card. Once they
 * hold an active-tier placement (post-enrollment-onboarding), the home
 * turns placement-centric: site, schedule, this week's hours, and
 * certifications — never the applicant welcome card.
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
  const proposedMatch = ctx && person ? await getOwnProposedMatch(ctx) : null;
  // The respectful, time-boxed post-decline notice (4.5) — only when no
  // newer proposal has replaced it.
  const declinedNotice =
    ctx && person && !proposedMatch ? await getOwnDeclinedPlacementNotice(ctx) : null;
  // While the tasks card below is the actionable checklist, the readiness
  // card lists only what it DOESN'T cover — no duplicate rows (Story 3.6).
  const readinessForCard =
    readiness && trainingJourney?.stage === "ONBOARDING"
      ? { ...readiness, items: readiness.items.filter((item) => item.kind !== "task") }
      : readiness;

  // The placed state: once enrollment onboarding is behind them, a
  // participant with an active-tier placement is working — the applicant
  // welcome card would be wrong. Their home turns placement-centric.
  const ownPlacement = ctx && person && !onboarding ? await getOwnPlacement(ctx) : null;
  const placed = ownPlacement?.active ? ownPlacement : null;
  const weekHours = ctx && placed ? await getOwnCurrentWeekHours(ctx) : null;
  const certifications = ctx && placed ? await getOwnCertifications(ctx) : [];

  const title = person?.legalFirstName
    ? `Welcome back, ${person.legalFirstName}!`
    : "Welcome to Project Nova";

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={
          onboarding
            ? `You're enrolled in ${onboarding.programName}. Your current step and next actions appear below, and you can ask your coordinator for support anytime.`
            : // The stage-vetted plain-language copy (5.1) frames the placed home.
              (placed?.stageBody ?? undefined)
        }
      >
        <AccentSpark className="size-6 shrink-0 text-accent" />
      </PageHeader>

      {onboarding ? (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Onboarding tasks"
            value={`${onboarding.completeCount}/${onboarding.totalCount}`}
            sublabel="Completed so far"
            icon={<NavIcon name="clipboard" className="size-5" />}
            tone="primary"
          />
          <StatCard
            label="Readiness items"
            value={readinessForCard?.ready ? 0 : (readinessForCard?.items.length ?? 0)}
            sublabel={readinessForCard?.ready ? "You're ready for matching" : "Still open"}
            icon={<NavIcon name="award" className="size-5" />}
            tone={readinessForCard?.ready ? "success" : "accent"}
          />
          <StatCard
            label="Program"
            value={onboarding.programName}
            sublabel="Transitional employment"
            icon={<NavIcon name="briefcase" className="size-5" />}
            tone="accent"
          />
        </div>
      ) : placed ? (
        <PlacementHomeTiles
          placement={placed}
          weekHours={weekHours}
          certificationCount={certifications.length}
        />
      ) : null}

      {proposedMatch ? <ParticipantProposedCard match={proposedMatch} /> : null}
      {declinedNotice ? <ParticipantDeclinedNotice notice={declinedNotice} /> : null}

      {onboarding ? (
        trainingJourney?.stage === "ONBOARDING" ? (
          <>
            <ParticipantTasks summary={onboarding} />
            {readinessForCard &&
            !readinessForCard.ready &&
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
        )
      ) : placed ? null : person ? (
        <Card variant="surface" className="flex max-w-xl flex-col gap-4">
          <p className="text-base leading-relaxed text-base-content/80">
            Thanks, {person.legalFirstName} — your account is set up. Your application is the
            next step.
          </p>
          <a
            href="/participant/application"
            className={`${buttonClassName("accent", "md")} w-full sm:w-auto`}
          >
            Continue to My Application
          </a>
        </Card>
      ) : (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          This is your home base. Your journey timeline and next steps will appear here as the
          program experience is built.
        </p>
      )}

      <Card variant="surface" className="max-w-xl border-primary/20 bg-accent/20">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="size-6 shrink-0 text-primary"
          >
            <path d="M12 19.2C7 15 2.6 11.4 2.4 7.4 2.3 4.6 4.4 2.6 6.9 2.6c2 0 3.8 1.2 5.1 3.2 1.3-2 3.1-3.2 5.1-3.2 2.5 0 4.6 2 4.5 4.8-.2 4-4.6 7.6-9.6 11.8Z" />
          </svg>
          <p className="text-sm leading-relaxed text-base-content">
            {placed ? (
              <>
                <span className="font-semibold">You&apos;re part of the team.</span> The work
                you&apos;re doing at {placed.siteName} matters — and your coordinator is in your
                corner the whole way.
              </>
            ) : (
              <>
                <span className="font-semibold">Small steps add up.</span> Every task you
                complete here builds toward real work with animals — and your coordinator is in
                your corner the whole way.
              </>
            )}
          </p>
        </div>
      </Card>
    </section>
  );
}
