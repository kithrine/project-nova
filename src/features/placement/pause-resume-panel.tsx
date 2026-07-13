"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  pausePlacementAction,
  resumePlacementAction,
  type PlacementFormState,
} from "@/features/placement/actions";

/**
 * The Active <-> Paused loop's Status Transition Controls (Story 5.7),
 * each behind a Confirmation Panel. A pause always carries a reason —
 * category required, elaboration optional — and an effective date; a
 * resume carries its resume date. Both are recorded on the lifecycle
 * event (ops-internal detail) and shown in the coordinator's History.
 */

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PausePanel({
  placementId,
  reasonOptions,
}: {
  placementId: string;
  /** PAUSE_REASON_CATEGORIES, passed from the server-rendered workspace. */
  reasonOptions: readonly { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    pausePlacementAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );

  if (!open) {
    return (
      <div className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4">
        <h2 className="text-sm font-semibold">Pause placement</h2>
        <p className="text-sm text-base-content/70">
          A temporary interruption — medical leave, a shelter closure, personal
          circumstances — pauses the placement without ending it. It can resume
          later; every cycle stays in History.
        </p>
        <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
          Pause Placement…
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex max-w-prose flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
    >
      <h2 className="text-sm font-semibold">Pause placement</h2>
      <label className="flex flex-col gap-1 text-sm">
        Reason (required)
        <select
          name="reasonKey"
          required
          defaultValue=""
          className="select select-bordered w-full max-w-xs"
        >
          <option value="" disabled>
            Choose a reason…
          </option>
          {reasonOptions.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (optional, internal)
        <textarea
          name="note"
          rows={2}
          className="textarea textarea-bordered w-full"
          placeholder="Anything the team should know"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Effective date
        <input
          type="date"
          name="effectiveDate"
          required
          defaultValue={todayValue()}
          className="input input-bordered w-fit"
        />
      </label>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Pausing…" : "Yes, Pause Placement"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ResumePanel({ placementId }: { placementId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    resumePlacementAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );

  if (!open) {
    return (
      <div className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4">
        <h2 className="text-sm font-semibold">Resume placement</h2>
        <p className="text-sm text-base-content/70">
          This placement is paused. Resuming returns it to Active — the pause
          stays in History.
        </p>
        <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
          Resume Placement…
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex max-w-prose flex-col gap-3 rounded-md border border-base-300 bg-base-100 p-4"
    >
      <h2 className="text-sm font-semibold">Resume placement</h2>
      <label className="flex flex-col gap-1 text-sm">
        Resume date
        <input
          type="date"
          name="resumeDate"
          required
          defaultValue={todayValue()}
          className="input input-bordered w-fit"
        />
      </label>
      {state.status === "error" && state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Resuming…" : "Yes, Resume Placement"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
