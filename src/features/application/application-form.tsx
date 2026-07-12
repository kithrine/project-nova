"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { DraftFormState } from "@/features/application/actions";
import { APPLICATION_PROMPTS } from "@/features/application/prompts";
import type { ApplicationView } from "@/server/services/application-service";

/**
 * Application Step Card (Story 2.3; docs/ux/component-guidelines.md).
 * A draft-first form: visible progress, an explicit non-destructive
 * Save Draft action, lenient saves, and a Concurrent update state when
 * another tab or device saved first. Prompts live in prompts.ts so the
 * submission completeness check (2.5) names fields exactly as shown here.
 */

export function ApplicationForm({
  application,
  action,
  initialState = { status: "idle" },
}: {
  application: ApplicationView;
  action: (prev: DraftFormState, formData: FormData) => Promise<DraftFormState>;
  initialState?: DraftFormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  const token = state.updatedAtToken ?? application.updatedAtToken;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5" noValidate>
      {/* Progress — text plus bar, never color alone */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-base-content/80">
          Application {application.applicationNumber} · {application.progressPercent}%
          filled in
        </p>
        <div
          role="progressbar"
          aria-valuenow={application.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Application progress"
          className="h-2 w-full overflow-hidden rounded-full bg-base-200"
        >
          <div
            className="h-full rounded-full bg-secondary transition-all"
            style={{ width: `${application.progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-base-content/60">
          Answer at your own pace — drafts save exactly as they are.
        </p>
      </div>

      {state.status === "conflict" ? (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium">This draft changed somewhere else</p>
          <p className="mt-1 text-base-content/80">{state.formError}</p>
          <a
            href="/participant/application"
            className="mt-2 inline-block font-medium underline underline-offset-2"
          >
            Reload Latest Draft
          </a>
        </div>
      ) : null}

      {state.status === "error" && state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      {state.status === "saved" ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
          {state.savedAtLabel} — you can leave and come back anytime.
        </p>
      ) : null}

      <input type="hidden" name="updatedAtToken" value={token} />

      {APPLICATION_PROMPTS.map((prompt) => (
        <div key={prompt.name} className="flex flex-col gap-1">
          <label htmlFor={prompt.name} className="text-sm font-medium">
            {prompt.label}
          </label>
          <p className="text-sm text-base-content/60">{prompt.hint}</p>
          <textarea
            id={prompt.name}
            name={prompt.name}
            rows={4}
            defaultValue={application[prompt.name] ?? ""}
            aria-invalid={errors[prompt.name] ? true : undefined}
            aria-describedby={errors[prompt.name] ? `${prompt.name}-error` : undefined}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
          {errors[prompt.name] ? (
            <p id={`${prompt.name}-error`} className="text-sm text-error">
              {errors[prompt.name]}
            </p>
          ) : null}
        </div>
      ))}

      {/* bottom-16 stacks this above the SubmitPanel's sticky bar (2.5) */}
      <div className="sticky bottom-16 -mx-1 bg-base-100/95 px-1 py-3 backdrop-blur-sm">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </form>
  );
}
