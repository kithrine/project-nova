"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  activatePlacementAction,
  type PlacementFormState,
} from "@/features/placement/actions";

/**
 * The activation gate (Story 5.6): a Status Transition Control with an
 * explicit Confirmation Panel. While activation blockers remain, each is
 * named with text + icon and the control stays disabled — never hidden —
 * so the coordinator understands why they cannot proceed (the Blocker
 * List above carries the resolving links). The server re-validates every
 * prerequisite inside the activation transaction regardless of what this
 * panel believes.
 */
export function ActivatePanel({
  placementId,
  blockers,
}: {
  placementId: string;
  blockers: string[];
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    activatePlacementAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );
  const eligible = blockers.length === 0;

  return (
    <form
      action={formAction}
      className="flex max-w-prose flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
    >
      <h2 className="text-sm font-semibold">Activate placement</h2>
      {eligible ? (
        <>
          <p className="text-sm text-base-content/70">
            Every activation prerequisite is met. Activating starts the
            placement today — the participant&apos;s effective start date is
            recorded and the placement becomes Active.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            The site is ready and the participant is starting — activate this
            placement.
          </label>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p id="activate-blockers-heading" className="text-sm text-base-content/70">
            Activation is waiting on:
          </p>
          <ul aria-labelledby="activate-blockers-heading" className="flex flex-col gap-1">
            {blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex items-start gap-1.5 text-sm text-base-content/80"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4.5M12 15.5v.5" />
                </svg>
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.status === "error" && state.formError ? (
        <p
          id="activate-error"
          role="alert"
          className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm"
        >
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!eligible || !confirmed || pending}
        aria-describedby={state.status === "error" ? "activate-error" : undefined}
        className="w-fit"
      >
        {pending ? "Activating…" : "Activate Placement"}
      </Button>
    </form>
  );
}
