import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { saveDraftAction, startApplicationAction } from "@/features/application/actions";
import { ApplicationForm } from "@/features/application/application-form";
import { DocumentChecklist } from "@/features/application/document-checklist";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import {
  getOwnApplications,
  resolveApplicationGateway,
} from "@/server/services/application-service";
import { getDocumentChecklist } from "@/server/services/document-service";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { ApplicationStatus } from "@/generated/prisma/client";

export const metadata = { title: "My Application" };

/**
 * My Application (Story 2.3). Gateway states: start fresh, resume a draft,
 * watch an in-review application, reapply after an ordinary closure, or a
 * respectful blocked state after permanent disqualification (set by 2.11).
 */
export default async function MyApplicationPage() {
  const ctx = await getOrProvisionAuthContext();
  if (!ctx) redirect("/sign-in");

  const person = await getOwnPerson(ctx);
  if (!person) redirect("/participant/onboarding");

  const applications = await getOwnApplications(ctx);
  const gateway = resolveApplicationGateway(applications);
  const draft = applications.find((a) => a.status === ApplicationStatus.DRAFT);
  const active = applications.find(
    (a) =>
      a.status !== ApplicationStatus.DRAFT &&
      a.status !== ApplicationStatus.ACCEPTED &&
      a.status !== ApplicationStatus.REJECTED &&
      a.status !== ApplicationStatus.DISQUALIFIED,
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">My Application</h1>

      {gateway.kind === "blocked" ? (
        <div className="max-w-prose rounded-md border border-base-300 bg-base-200/60 p-6">
          <p className="text-base leading-relaxed text-base-content/85">
            A new application can&apos;t be started on this account. If you have questions
            or think this is a mistake, please contact Project Nova — we&apos;re glad to
            talk it through with you.
          </p>
        </div>
      ) : null}

      {gateway.kind === "resume-draft" && draft ? (
        <>
          <ApplicationForm
            application={draft}
            action={saveDraftAction.bind(null, draft.id)}
          />
          <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
            <h2 className="text-lg font-semibold">Your documents</h2>
            <p className="max-w-prose text-sm text-base-content/70">
              Required documents must be uploaded before you can submit. Photos are fine.
            </p>
            <DocumentChecklist
              applicationId={draft.id}
              items={await getDocumentChecklist(ctx, draft.id)}
            />
          </div>
        </>
      ) : null}

      {gateway.kind === "in-review" && active ? (
        <>
          <div className="max-w-prose rounded-md border border-base-300 bg-base-100 p-6">
            <p className="text-sm font-medium text-base-content/70">
              Application {active.applicationNumber}
            </p>
            <p className="mt-1 text-lg font-semibold">{active.statusLabel}</p>
            <p className="mt-2 text-base leading-relaxed text-base-content/80">
              Your application is with our team. No action is needed right now — we&apos;ll
              keep you informed at every step.
            </p>
          </div>
          <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
            <h2 className="text-lg font-semibold">Your documents</h2>
            <p className="max-w-prose text-sm text-base-content/70">
              If our team asks for another document during review, you can add or replace
              it here.
            </p>
            <DocumentChecklist
              applicationId={active.id}
              items={await getDocumentChecklist(ctx, active.id)}
            />
          </div>
        </>
      ) : null}

      {gateway.kind === "can-apply" ? (
        <div className="flex max-w-prose flex-col items-start gap-4">
          {gateway.reapplying ? (
            <p className="text-base leading-relaxed text-base-content/80">
              You may apply again — a fresh application, reviewed with fresh eyes. Your
              earlier application stays on record but doesn&apos;t limit this one.
            </p>
          ) : (
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
    </section>
  );
}
