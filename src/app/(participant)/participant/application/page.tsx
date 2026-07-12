import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  saveDraftAction,
  startApplicationAction,
  submitApplicationAction,
} from "@/features/application/actions";
import { ApplicationForm } from "@/features/application/application-form";
import { DocumentChecklist } from "@/features/application/document-checklist";
import { JourneyTimeline } from "@/features/application/journey-timeline";
import { NextStepCard } from "@/features/application/next-step-card";
import { APPLICATION_PROMPTS } from "@/features/application/prompts";
import { SubmitPanel } from "@/features/application/submit-panel";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { toJourneyView } from "@/server/services/application-journey";
import {
  getOwnApplications,
  getOwnUpcomingAppointment,
  missingSubmissionItems,
  NON_TERMINAL_STATUSES,
  resolveApplicationGateway,
} from "@/server/services/application-service";
import { getDocumentChecklist } from "@/server/services/document-service";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { ApplicationStatus } from "@/generated/prisma/client";

export const metadata = { title: "My Application" };

/**
 * My Application (Stories 2.3, 2.5, 2.6) — built around the Journey Timeline
 * and Next Step Card. The journey is a participant-safe projection: internal
 * review phases collapse into simplified stages, and restricted review
 * detail is structurally absent from the view model. Gateway states from 2.3
 * still drive what renders below the journey: the draft form, the in-review
 * documents, a reapplication start, or a respectful closed state. Arriving
 * with ?submitted=1 (2.5's redirect) shows the post-submission confirmation.
 */
export default async function MyApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const ctx = await getOrProvisionAuthContext();
  if (!ctx) redirect("/sign-in");

  const person = await getOwnPerson(ctx);
  if (!person) redirect("/participant/onboarding");

  const justSubmitted = (await searchParams).submitted === "1";

  const applications = await getOwnApplications(ctx);
  const gateway = resolveApplicationGateway(applications);
  const draft = applications.find((a) => a.status === ApplicationStatus.DRAFT);
  const active = applications.find(
    (a) =>
      a.status !== ApplicationStatus.DRAFT &&
      (NON_TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(a.status),
  );

  // The journey follows the one in-flight application, or the most recent
  // terminal one (applications come newest first).
  const journeyApp = draft ?? active ?? applications[0];
  const journeyChecklist =
    journeyApp &&
    (NON_TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(journeyApp.status)
      ? await getDocumentChecklist(ctx, journeyApp.id)
      : null;
  const appointment =
    journeyApp && journeyApp.status === ApplicationStatus.INTERVIEW
      ? await getOwnUpcomingAppointment(ctx, journeyApp.id)
      : null;
  const journey = journeyApp
    ? toJourneyView(
        journeyApp,
        journeyChecklist
          ? journeyChecklist.filter((i) => i.current).map((i) => i.documentType)
          : undefined,
        appointment,
      )
    : null;
  const previous = applications.filter((a) => a.id !== journeyApp?.id);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">My Application</h1>

      {justSubmitted && active ? (
        <div
          role="status"
          className="max-w-prose rounded-md border border-success/40 bg-success/5 p-6"
        >
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 size-6 shrink-0 text-success"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold">
                Your application is submitted — thank you
              </h2>
              <p className="mt-2 text-base leading-relaxed text-base-content/80">
                Here&apos;s what happens next: our team reads every application, and
                we&apos;ll reach out if we need anything more from you. There&apos;s
                nothing you need to do right now — this page will always show where
                things stand.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {journey && journeyApp ? (
        <div className="flex flex-col gap-5">
          {journeyApp.status !== ApplicationStatus.DRAFT ? (
            <p className="text-sm font-medium text-base-content/70">
              Application {journeyApp.applicationNumber}
              {journey.submittedAtLabel ? ` · Submitted ${journey.submittedAtLabel}` : ""}
            </p>
          ) : null}
          <JourneyTimeline steps={journey.steps} />
          <NextStepCard step={journey.nextStep} stageLabel={journey.stageLabel} />
        </div>
      ) : null}

      {gateway.kind === "resume-draft" && draft && journeyChecklist ? (
        <>
          <div id="application-form" className="scroll-mt-6 border-t border-base-300 pt-6">
            <ApplicationForm
              application={draft}
              action={saveDraftAction.bind(null, draft.id)}
            />
          </div>
          <div
            id="documents"
            className="flex scroll-mt-6 flex-col gap-3 border-t border-base-300 pt-6"
          >
            <h2 className="text-lg font-semibold">Your documents</h2>
            <p className="max-w-prose text-sm text-base-content/70">
              Required documents must be uploaded before you can submit. Photos are fine.
            </p>
            <DocumentChecklist applicationId={draft.id} items={journeyChecklist} />
          </div>
          <SubmitPanel
            updatedAtToken={draft.updatedAtToken}
            missingItems={missingSubmissionItems(
              draft,
              journeyChecklist.filter((i) => i.current).map((i) => i.documentType),
            )}
            action={submitApplicationAction.bind(null, draft.id)}
          />
        </>
      ) : null}

      {gateway.kind === "in-review" && active && journeyChecklist ? (
        <>
          <div
            id="documents"
            className="flex scroll-mt-6 flex-col gap-3 border-t border-base-300 pt-6"
          >
            <h2 className="text-lg font-semibold">Your documents</h2>
            <p className="max-w-prose text-sm text-base-content/70">
              If our team asks for another document during review, you can add or replace
              it here.
            </p>
            <DocumentChecklist applicationId={active.id} items={journeyChecklist} />
          </div>
          <details className="max-w-prose rounded-md border border-base-300 bg-base-100">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
              Your submitted answers
            </summary>
            <dl className="flex flex-col gap-4 border-t border-base-300 px-6 py-4">
              {APPLICATION_PROMPTS.map((prompt) => (
                <div key={prompt.name}>
                  <dt className="text-sm font-medium text-base-content/70">
                    {prompt.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {active[prompt.name] ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      ) : null}

      {gateway.kind === "waiting-period" ? (
        <div className="max-w-prose rounded-md border border-base-300 bg-base-200/60 p-6">
          <p className="text-base leading-relaxed text-base-content/85">
            Your previous application was decided on {gateway.decidedOnLabel}. You may
            start a new application on or after {gateway.reapplyOnLabel} — we&apos;d be
            glad to see it.
          </p>
        </div>
      ) : null}

      {gateway.kind === "can-apply" &&
      journeyApp?.status !== ApplicationStatus.ACCEPTED ? (
        <div className="flex max-w-prose flex-col items-start gap-4 border-t border-base-300 pt-6">
          {gateway.reapplying ? null : (
            <p className="text-base leading-relaxed text-base-content/80">
              Plain questions, at your pace. Your answers save as a draft, and nothing is
              sent to our team until you choose to submit.
            </p>
          )}
          <form action={startApplicationAction}>
            <Button type="submit">Start Your Application</Button>
          </form>
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
          <h2 className="text-lg font-semibold">Previous applications</h2>
          <ul className="flex max-w-prose flex-col gap-2">
            {previous.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-base-300 bg-base-100 px-4 py-3 text-sm"
              >
                <span className="font-medium">{application.applicationNumber}</span>
                <span className="text-base-content/70">
                  {application.statusLabel}
                  {application.submittedAtLabel
                    ? ` · Submitted ${application.submittedAtLabel}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
