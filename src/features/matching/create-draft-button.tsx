"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  createMatchDraftAction,
  type MatchFormState,
} from "@/features/matching/actions";

/** The 4.3 entry point from a reviewed pairing into a Draft match. */
export function CreateDraftButton({
  enrollmentId,
  siteId,
}: {
  enrollmentId: string;
  siteId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createMatchDraftAction.bind(null, enrollmentId, siteId),
    { status: "idle" } as MatchFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && state.formError ? (
        <p role="alert" className="max-w-prose rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creating…" : "Create Match Draft"}
      </Button>
    </form>
  );
}
