"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { SubmitFormState } from "@/features/application/actions";
import type { MissingSubmissionItem } from "@/server/services/application-service";

/**
 * Submit panel (Story 2.5; docs/ux/component-guidelines.md). The Submit
 * control stays disabled — with the reason spelled out — until every
 * required answer and document is complete. Each missing item links
 * straight to the control that resolves it. Mobile-first sticky action bar;
 * status is always text plus icon, never color alone.
 */

function ItemIcon({ kind }: { kind: MissingSubmissionItem["kind"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-5 shrink-0 text-warning"
    >
      {kind === "field" ? (
        // pencil-on-line: an answer to finish writing
        <>
          <path d="M4 20h16" />
          <path d="m6 16 9.5-9.5a2.1 2.1 0 0 1 3 3L9 19l-4 1z" />
        </>
      ) : (
        // page-with-arrow: a document to upload
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M12 16v-5m0 0-2 2m2-2 2 2" />
        </>
      )}
    </svg>
  );
}

export function SubmitPanel({
  updatedAtToken,
  missingItems,
  action,
  initialState = { status: "idle" },
}: {
  updatedAtToken: string;
  missingItems: MissingSubmissionItem[];
  action: (prev: SubmitFormState, formData: FormData) => Promise<SubmitFormState>;
  initialState?: SubmitFormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const ready = missingItems.length === 0;

  return (
    <section aria-labelledby="submit-heading" className="flex flex-col gap-4 border-t border-base-300 pt-6">
      <h2 id="submit-heading" className="text-lg font-semibold">
        Submit your application
      </h2>

      {ready ? (
        <p id="submit-hint" className="max-w-prose text-sm text-base-content/70">
          Everything on the checklist is complete. Submitting sends your last saved
          answers to our team — after that, the form can&apos;t be edited, though you can
          still replace documents if we ask for one.
        </p>
      ) : (
        <div className="flex max-w-prose flex-col gap-2">
          <p id="submit-hint" className="text-sm text-base-content/70">
            The Submit button unlocks once these {missingItems.length === 1 ? "is" : "are"}{" "}
            finished — no rush, your draft keeps waiting:
          </p>
          <ul className="flex flex-col gap-2">
            {missingItems.map((item) => (
              <li key={item.anchor} className="flex items-start gap-2 text-sm">
                <ItemIcon kind={item.kind} />
                <span>
                  <a href={`#${item.anchor}`} className="font-medium underline underline-offset-2">
                    {item.label}
                  </a>{" "}
                  — {item.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.status === "conflict" || state.status === "lifecycle" ? (
        <div role="alert" className="max-w-prose rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">
            {state.status === "lifecycle"
              ? "Already submitted"
              : "This application changed somewhere else"}
          </p>
          <p className="mt-1 text-base-content/80">{state.formError}</p>
          <a
            href="/participant/application"
            className="mt-2 inline-block font-medium underline underline-offset-2"
          >
            Reload Latest Version
          </a>
        </div>
      ) : null}

      {state.status === "error" && state.formError ? (
        <p role="alert" className="max-w-prose rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="updatedAtToken" value={updatedAtToken} />
        <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 bg-base-100/95 px-1 py-3 backdrop-blur-sm">
          <p className="text-sm text-base-content/70">
            {ready
              ? "Ready when you are."
              : `${missingItems.length} item${missingItems.length === 1 ? "" : "s"} left to finish`}
          </p>
          <Button type="submit" disabled={!ready || pending} aria-describedby="submit-hint">
            {pending ? "Submitting…" : "Submit Application"}
          </Button>
        </div>
      </form>
    </section>
  );
}
