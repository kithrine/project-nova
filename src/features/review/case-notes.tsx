"use client";

import { useRef } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { CaseNoteFormState } from "@/features/review/actions";
import type { CaseNoteView } from "@/server/services/application-review-service";

/**
 * Internal notes (Story 2.7; Case Note Composer per component-guidelines).
 * Nova Operations only — these notes never appear in the participant journey
 * (2.6) or any shelter experience (AC6).
 */
export function CaseNotes({
  notes,
  canCreate,
  action,
  initialState = { status: "idle" },
}: {
  notes: CaseNoteView[];
  canCreate: boolean;
  action: (prev: CaseNoteFormState, formData: FormData) => Promise<CaseNoteFormState>;
  initialState?: CaseNoteFormState;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: CaseNoteFormState, formData: FormData) => {
      const next = await action(prev, formData);
      if (next.status === "saved") formRef.current?.reset();
      return next;
    },
    initialState,
  );

  return (
    <section aria-labelledby="case-notes-heading" className="flex flex-col gap-3">
      <h3 id="case-notes-heading" className="text-base font-semibold">
        Internal notes
      </h3>
      <p className="text-sm text-base-content/60">
        Visible to Nova Operations only — never to applicants or shelters.
      </p>

      {canCreate ? (
        <form ref={formRef} action={formAction} className="flex max-w-prose flex-col gap-2">
          <label htmlFor="case-note-body" className="sr-only">
            New internal note
          </label>
          <textarea
            id="case-note-body"
            name="body"
            rows={3}
            required
            placeholder="Add a note for the team…"
            className="rounded-md border border-base-300 px-3 py-2 text-sm"
          />
          {state.status === "error" && state.formError ? (
            <p role="alert" className="text-sm text-error">
              {state.formError}
            </p>
          ) : null}
          {state.status === "saved" ? (
            <p role="status" className="text-sm text-success">
              Note saved.
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Add Note"}
          </Button>
        </form>
      ) : null}

      {notes.length === 0 ? (
        <p className="text-sm text-base-content/60">No notes yet.</p>
      ) : (
        <ul className="flex max-w-prose flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-base-300 bg-base-100 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
              <p className="mt-2 text-xs text-base-content/60">
                {note.authorName} · {note.atLabel}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
