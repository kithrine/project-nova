"use client";

import { useRef } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  submitEvaluationAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type { EvaluationsTabView } from "@/server/services/placement-service";

/**
 * The Evaluations tab (Story 5.10): the Evaluation Form for shelter
 * staff — labeled rating scales, never color- or number-only — above the
 * chronological list Nova Operations and the shelter both read. The
 * rubric arrives as props from the server-rendered workspace so domain
 * modules stay out of the client bundle.
 */

export interface EvaluationFormCatalog {
  areas: readonly { key: string; label: string }[];
  ratings: readonly { key: string; label: string }[];
}

export function EvaluationsTab({
  placementId,
  evaluations,
  catalog,
}: {
  placementId: string;
  evaluations: EvaluationsTabView;
  catalog: EvaluationFormCatalog;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: PlacementFormState, formData: FormData) => {
      const next = await submitEvaluationAction(placementId, prev, formData);
      if (next.status === "saved") formRef.current?.reset();
      return next;
    },
    { status: "idle" } as PlacementFormState,
  );

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      {evaluations.viewerCanSubmit ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
        >
          <h2 className="text-sm font-semibold">Submit an evaluation</h2>
          <label className="flex flex-col gap-1 text-sm">
            Evaluation date
            <input
              type="date"
              name="evaluationDate"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="input input-bordered w-fit"
            />
          </label>
          {catalog.areas.map((area) => (
            <fieldset key={area.key} className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{area.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {catalog.ratings.map((rating) => (
                  <label
                    key={rating.key}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="radio"
                      name={`rating-${area.key}`}
                      value={rating.key}
                      required
                    />
                    {rating.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            What went well
            <textarea
              name="strengths"
              rows={2}
              required
              className="textarea textarea-bordered w-full"
              placeholder="Strengths you observed this period"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Areas to grow (optional)
            <textarea
              name="growthAreas"
              rows={2}
              className="textarea textarea-bordered w-full"
              placeholder="Anything to work on together"
            />
          </label>
          {state.status === "error" && state.formError ? (
            <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
              {state.formError}
            </p>
          ) : null}
          {state.status === "saved" ? (
            <p role="status" className="text-sm text-success">
              Evaluation submitted.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Submitting…" : "Submit Evaluation"}
          </Button>
        </form>
      ) : null}

      {evaluations.entries.length === 0 ? (
        <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No evaluations yet. Shelter staff submit them while the placement is
          active.
        </p>
      ) : (
        <ol aria-label="Evaluations" className="flex flex-col gap-2">
          {evaluations.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3"
            >
              <p className="text-sm font-medium">
                Evaluation for {entry.evaluationDateLabel}
              </p>
              <dl className="flex flex-col gap-1">
                {entry.ratings.map((rating) => (
                  <div key={rating.areaLabel} className="flex flex-wrap gap-1 text-sm">
                    <dt className="text-base-content/70">{rating.areaLabel}:</dt>
                    <dd className="font-medium">{rating.ratingLabel}</dd>
                  </div>
                ))}
              </dl>
              <p className="whitespace-pre-wrap text-sm">
                <span className="text-base-content/70">What went well: </span>
                {entry.strengths}
              </p>
              {entry.growthAreas ? (
                <p className="whitespace-pre-wrap text-sm">
                  <span className="text-base-content/70">Areas to grow: </span>
                  {entry.growthAreas}
                </p>
              ) : null}
              <p className="text-xs text-base-content/60">
                {entry.authorName} · submitted {entry.submittedAtLabel}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
