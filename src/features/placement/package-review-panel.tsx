"use client";

import { useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  approvePlacementPackageAction,
  requestPlacementChangesAction,
  type PlacementFormState,
} from "@/features/placement/actions";

/**
 * The Shelter Manager's package review (Story 5.2 AC4): approve the
 * site/supervisor/schedule package, or return it to the coordinator with
 * a REQUIRED, actionable note — a revision loop, never a dead end. Each
 * action is a Status Transition Control with its own confirmation, never
 * a status dropdown (RULES.md).
 */
export function PackageReviewPanel({ placementId }: { placementId: string }) {
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");
  const [approveState, approveFormAction, approvePending] = useActionState(
    approvePlacementPackageAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );
  const [changesState, changesFormAction, changesPending] = useActionState(
    requestPlacementChangesAction.bind(null, placementId),
    { status: "idle" } as PlacementFormState,
  );
  const pending = approvePending || changesPending;

  if (mode === "approve") {
    return (
      <form
        action={approveFormAction}
        className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4"
      >
        <p className="text-sm font-medium">Approve this placement package?</p>
        <p className="text-sm text-base-content/70">
          You&apos;re confirming the site, supervisor, and schedule work for your
          organization. Nova prepares onboarding next.
        </p>
        {approveState.status === "error" && approveState.formError ? (
          <p role="alert" className="text-sm text-error">
            {approveState.formError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" aria-disabled={pending} onClick={(e) => pending && e.preventDefault()} className="w-full sm:w-auto">
            {approvePending ? "Approving…" : "Yes, Approve Package"}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setMode("idle")} className="w-full sm:w-auto">
            Go Back
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "changes") {
    return (
      <form
        action={changesFormAction}
        className="flex max-w-prose flex-col gap-2 rounded-md border border-base-300 bg-base-100 p-4"
      >
        <p className="text-sm font-medium">Request changes to this package?</p>
        <div className="flex flex-col gap-1">
          <label htmlFor={`package-note-${placementId}`} className="text-sm font-medium">
            Note for the coordinator (required)
          </label>
          <textarea
            id={`package-note-${placementId}`}
            name="note"
            rows={3}
            required
            placeholder="What needs to change — site, supervisor, or schedule."
            className="textarea textarea-bordered w-full text-sm"
          />
        </div>
        {changesState.status === "error" && changesState.formError ? (
          <p role="alert" className="text-sm text-error">
            {changesState.formError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" aria-disabled={pending} onClick={(e) => pending && e.preventDefault()} className="w-full sm:w-auto">
            {changesPending ? "Sending…" : "Yes, Request Changes"}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setMode("idle")} className="w-full sm:w-auto">
            Go Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex max-w-prose flex-col gap-3 rounded-md border border-warning/40 bg-warning/5 p-4">
      <h2 className="text-sm font-semibold">Package review</h2>
      <p className="text-sm text-base-content/80">
        Nova proposed this site, supervisor, and schedule package for your
        review. Approve it, or send it back with what needs to change.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => setMode("approve")} className="w-full sm:w-auto">
          Approve Package
        </Button>
        <Button type="button" variant="secondary" onClick={() => setMode("changes")} className="w-full sm:w-auto">
          Request Changes
        </Button>
      </div>
    </div>
  );
}
