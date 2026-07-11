"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { FundingFormState } from "@/features/funding/actions";
import type { FundingSourceView } from "@/server/services/funding-source-service";

/**
 * Funding-source form (Story 1.8). Labels above inputs, programmatic error
 * association, mobile-first single column (docs/ux/accessibility.md).
 * Presentation only — validation and rules live at the server boundary.
 */
export function FundingSourceForm({
  action,
  fundingSource,
  submitLabel,
  initialState = { status: "idle" },
}: {
  action: (prev: FundingFormState, formData: FormData) => Promise<FundingFormState>;
  fundingSource?: FundingSourceView;
  submitLabel: string;
  initialState?: FundingFormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const errorId = (field: string) =>
    state.fieldErrors?.[field] ? `${field}-error` : undefined;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
      {state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={fundingSource?.name ?? ""}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby={errorId("name")}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.name ? (
          <p id="name-error" className="text-sm text-error">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kind" className="text-sm font-medium">
          Kind
        </label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue={fundingSource?.kind ?? "GRANT"}
          aria-invalid={state.fieldErrors?.kind ? true : undefined}
          aria-describedby={errorId("kind")}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        >
          <option value="GRANT">Grant</option>
          <option value="CONTRACT">Contract</option>
          <option value="OTHER">Other</option>
        </select>
        {state.fieldErrors?.kind ? (
          <p id="kind-error" className="text-sm text-error">
            {state.fieldErrors.kind}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="code" className="text-sm font-medium">
          Code <span className="font-normal text-base-content/60">(optional)</span>
        </label>
        <input
          id="code"
          name="code"
          type="text"
          defaultValue={fundingSource?.code ?? ""}
          aria-describedby={errorId("code")}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.code ? (
          <p id="code-error" className="text-sm text-error">
            {state.fieldErrors.code}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date <span className="font-normal text-base-content/60">(optional)</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={fundingSource?.startDate ?? ""}
            aria-describedby={errorId("startDate")}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.startDate ? (
            <p id="startDate-error" className="text-sm text-error">
              {state.fieldErrors.startDate}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="endDate" className="text-sm font-medium">
            End date <span className="font-normal text-base-content/60">(optional)</span>
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={fundingSource?.endDate ?? ""}
            aria-invalid={state.fieldErrors?.endDate ? true : undefined}
            aria-describedby={errorId("endDate")}
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.endDate ? (
            <p id="endDate-error" className="text-sm text-error">
              {state.fieldErrors.endDate}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes <span className="font-normal text-base-content/60">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={fundingSource?.notes ?? ""}
          aria-describedby={errorId("notes")}
          className="rounded-md border border-base-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.notes ? (
          <p id="notes-error" className="text-sm text-error">
            {state.fieldErrors.notes}
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
