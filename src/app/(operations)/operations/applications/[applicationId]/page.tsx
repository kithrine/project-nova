import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { Restricted } from "@/components/feedback/restricted";
import { addCaseNoteAction } from "@/features/review/actions";
import { CaseNotes } from "@/features/review/case-notes";
import { WorkspaceTabs } from "@/features/review/workspace-tabs";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors/app-error";
import {
  getApplicationHistory,
  getApplicationWorkspace,
  listCaseNotes,
  openBackgroundTab,
  resolveWorkspaceTab,
  WORKSPACE_TAB_LABELS,
  WORKSPACE_TABS,
  OPERATIONS_STATUS_LABELS,
} from "@/server/services/application-review-service";
import { listDocumentsForReview } from "@/server/services/document-service";
import { formatFileSize } from "@/lib/documents";
import { ApplicationStatus } from "@/generated/prisma/client";

export const metadata = { title: "Application workspace" };

/** The full internal review path, in order — shown to staff, never applicants. */
const INTERNAL_JOURNEY: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.ELIGIBILITY_REVIEW,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.BACKGROUND_REVIEW,
];

/**
 * Application Workspace (Story 2.7, AC2–AC4, AC6;
 * docs/ux/wireframes-layouts.md): entity header, full INTERNAL journey
 * (unlike 2.6's simplified view), and tabs. Tabs navigate via ?tab= so only
 * the active panel is rendered — restricted background content is decided
 * server-side per request: authorized access is audited, everyone else gets
 * the Restricted state and no background data in the payload.
 */
export default async function ApplicationWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "application.view") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const { applicationId } = await params;
  const tab = resolveWorkspaceTab((await searchParams).tab);

  let workspace;
  try {
    workspace = await getApplicationWorkspace(ctx, applicationId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const decided =
    workspace.status === ApplicationStatus.ACCEPTED ||
    workspace.status === ApplicationStatus.REJECTED ||
    workspace.status === ApplicationStatus.DISQUALIFIED;

  return (
    <section className="flex flex-col gap-6">
      {/* Entity header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-base-content/60">
          <Link href="/operations/applications" className="underline underline-offset-2">
            Applications
          </Link>{" "}
          / {workspace.applicationNumber}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{workspace.applicantName}</h1>
        <p className="text-sm text-base-content/70">
          {workspace.applicationNumber} · <span className="font-medium">{workspace.statusLabel}</span>
          {workspace.submittedAtLabel ? ` · Submitted ${workspace.submittedAtLabel}` : ""}
        </p>
      </div>

      {/* Full internal journey progress — the real phases, staff-only */}
      <ol aria-label="Internal review progress" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {INTERNAL_JOURNEY.map((status, index) => {
          const isCurrent = workspace.status === status;
          const currentIndex = INTERNAL_JOURNEY.indexOf(workspace.status);
          const isPast = decided || (currentIndex > -1 && index < currentIndex);
          return (
            <li key={status} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-base-content/40">→</span>
              ) : null}
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={
                  isCurrent
                    ? "rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-content"
                    : isPast
                      ? "text-base-content/80"
                      : "text-base-content/50"
                }
              >
                {OPERATIONS_STATUS_LABELS[status]}
                {isPast && !isCurrent ? <span className="sr-only"> — completed</span> : null}
              </span>
            </li>
          );
        })}
        {decided ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base-content/40">→</span>
            <span
              aria-current="step"
              className="rounded-full bg-neutral px-2.5 py-0.5 font-medium text-neutral-content"
            >
              {workspace.statusLabel}
            </span>
          </li>
        ) : null}
      </ol>

      <WorkspaceTabs
        tabs={WORKSPACE_TABS.map((key) => ({
          key,
          label: WORKSPACE_TAB_LABELS[key],
          href: `/operations/applications/${workspace.id}?tab=${key}`,
          selected: tab === key,
        }))}
      />

      <div id="workspace-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" ? (
          <div className="flex flex-col gap-8">
            <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
              <h2 id="actions-heading" className="text-base font-semibold">
                Actions for this phase
              </h2>
              {workspace.actions.length === 0 ? (
                <p className="text-sm text-base-content/60">
                  This application is decided — no review actions remain.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {workspace.actions.map((action) => (
                    <li key={action.label}>
                      <button
                        type="button"
                        disabled
                        aria-describedby="actions-note"
                        className="cursor-not-allowed rounded-md border border-base-300 bg-base-200/60 px-4 py-2 text-sm font-medium text-base-content/50"
                      >
                        {action.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {workspace.actions.length > 0 ? (
                <p id="actions-note" className="max-w-prose text-sm text-base-content/60">
                  Review actions arrive with{" "}
                  {[...new Set(workspace.actions.map((a) => a.arrivesWith))].join(", ")} —
                  several are pending policy validation
                  (docs/planning/open-questions.md) and stay disabled until approved.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="answers-heading" className="flex flex-col gap-3">
              <h2 id="answers-heading" className="text-base font-semibold">
                Application answers
              </h2>
              <dl className="flex max-w-prose flex-col gap-4">
                {workspace.answers.map((answer) => (
                  <div key={answer.label}>
                    <dt className="text-sm font-medium text-base-content/70">{answer.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {answer.value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <CaseNotes
              notes={await listCaseNotes(ctx, workspace.id)}
              canCreate={hasPermission(ctx, "caseNote.create")}
              action={addCaseNoteAction.bind(null, workspace.id)}
            />
          </div>
        ) : null}

        {tab === "documents" ? (
          await (async () => {
            const documents = await listDocumentsForReview(ctx, workspace.id);
            return documents.length === 0 ? (
              <p className="text-sm text-base-content/60">No documents uploaded.</p>
            ) : (
              <ul className="flex max-w-prose flex-col gap-2">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">{document.typeLabel}</span>
                      <span className="text-base-content/60">
                        {" "}
                        · {document.fileName} · {formatFileSize(document.sizeBytes)}
                      </span>
                    </span>
                    <a
                      href={`/api/documents/${document.id}/download`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            );
          })()
        ) : null}

        {tab === "eligibility" ? (
          <p className="max-w-prose text-sm text-base-content/70">
            No eligibility review has been recorded. The eligibility workflow arrives
            with Story 2.8 and remains disabled until Nova&apos;s eligibility policy is
            approved (docs/planning/open-questions.md).
          </p>
        ) : null}

        {tab === "interview" ? (
          <p className="max-w-prose text-sm text-base-content/70">
            No interview has been scheduled. The interview workflow arrives with
            Story 2.9.
          </p>
        ) : null}

        {tab === "background" ? (
          (await openBackgroundTab(ctx, workspace.id)).authorized ? (
            <div className="flex max-w-prose flex-col gap-3">
              <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
                You are viewing restricted background review content. This access has
                been recorded in the audit log.
              </p>
              <p className="text-sm text-base-content/70">
                No background review has been recorded for this application. The
                background decision workflow arrives with Story 2.10 and remains
                disabled pending policy validation.
              </p>
            </div>
          ) : (
            <Restricted
              title="Background review is restricted"
              description="Background review content requires the restricted background permission, which is granted explicitly — it does not come with any base role — and every access is audited. If your work requires it, contact your Nova administrator."
            />
          )
        ) : null}

        {tab === "history" ? (
          await (async () => {
            const history = await getApplicationHistory(ctx, workspace.id);
            return history.length === 0 ? (
              <p className="text-sm text-base-content/60">No lifecycle events recorded.</p>
            ) : (
              <ol className="flex max-w-prose flex-col gap-2">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md border border-base-300 bg-base-100 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {entry.fromLabel} → {entry.toLabel}
                    </span>
                    <span className="text-base-content/60">
                      {" "}
                      · {entry.atLabel} · {entry.actorName}
                    </span>
                  </li>
                ))}
              </ol>
            );
          })()
        ) : null}
      </div>
    </section>
  );
}
