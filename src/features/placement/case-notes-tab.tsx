"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  addPlacementCaseNoteAction,
  editPlacementCaseNoteAction,
  type PlacementFormState,
} from "@/features/placement/actions";
import type {
  CaseNoteTabView,
  PlacementCaseNoteView,
} from "@/server/services/placement-service";

/**
 * The Case Notes tab (Story 5.9): the Case Note Composer plus the
 * reverse-chronological internal notes list. This component only ever
 * renders inside a Nova view model that carries the notes — shelter and
 * participant views have no caseNotes data at all. Edits archive the
 * prior version (AC5); history renders through a disclosure per note.
 */

function NoteCard({
  placementId,
  note,
  canEdit,
}: {
  placementId: string;
  note: PlacementCaseNoteView;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: PlacementFormState, formData: FormData) => {
      const next = await editPlacementCaseNoteAction(
        placementId,
        note.id,
        prev,
        formData,
      );
      // Close the editor once the save lands; errors keep it open.
      if (next.status === "saved") setEditing(false);
      return next;
    },
    { status: "idle" } as PlacementFormState,
  );

  return (
    <li className="flex flex-col gap-2 rounded-md border border-base-300 bg-base-100 px-4 py-3">
      {editing ? (
        <form action={formAction} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={`edit-note-${note.id}`}>
            Edit note
          </label>
          <textarea
            id={`edit-note-${note.id}`}
            name="body"
            rows={3}
            required
            defaultValue={note.body}
            className="textarea textarea-bordered w-full"
          />
          {state.status === "error" && state.formError ? (
            <p role="alert" className="text-sm text-error">
              {state.formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save Edit"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.body}</p>
          <p className="text-xs text-base-content/60">
            {note.authorName} · {note.atLabel}
            {note.revisions.length > 0
              ? ` · Edited (${note.revisions.length} earlier ${
                  note.revisions.length === 1 ? "version" : "versions"
                })`
              : ""}
          </p>
          {note.revisions.length > 0 ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-base-content/70">
                Show earlier versions
              </summary>
              <ul className="mt-1 flex flex-col gap-1 border-l-2 border-base-300 pl-3">
                {note.revisions.map((revision, index) => (
                  <li key={index} className="flex flex-col gap-0.5">
                    <p className="whitespace-pre-wrap text-base-content/80">
                      {revision.priorBody}
                    </p>
                    <p className="text-base-content/60">
                      Replaced by {revision.editorName} · {revision.atLabel}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-fit"
              onClick={() => setEditing(true)}
            >
              Edit Note
            </Button>
          ) : null}
        </>
      )}
    </li>
  );
}

export function CaseNotesTab({
  placementId,
  caseNotes,
}: {
  placementId: string;
  caseNotes: CaseNoteTabView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: PlacementFormState, formData: FormData) => {
      const next = await addPlacementCaseNoteAction(placementId, prev, formData);
      if (next.status === "saved") formRef.current?.reset();
      return next;
    },
    { status: "idle" } as PlacementFormState,
  );

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-base-content/70">
        Internal coordination notes — visible to Nova Operations only, never to
        shelters or participants.
      </p>

      {caseNotes.viewerCanCreate ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="new-case-note">
            New internal note
          </label>
          <textarea
            id="new-case-note"
            name="body"
            rows={3}
            required
            placeholder="Add a note for the team…"
            className="textarea textarea-bordered w-full"
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

      {caseNotes.notes.length === 0 ? (
        <p className="rounded-md border border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/70">
          No notes yet.
        </p>
      ) : (
        <ul aria-label="Case notes" className="flex flex-col gap-2">
          {caseNotes.notes.map((note) => (
            <NoteCard
              key={note.id}
              placementId={placementId}
              note={note}
              canEdit={caseNotes.viewerCanCreate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
