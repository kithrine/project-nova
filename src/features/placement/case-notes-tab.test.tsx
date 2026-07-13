import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CaseNoteTabView } from "@/server/services/placement-service";
import { CaseNotesTab } from "./case-notes-tab";

vi.mock("@/features/placement/actions", () => ({
  addPlacementCaseNoteAction: vi.fn(async () => ({ status: "saved" })),
  editPlacementCaseNoteAction: vi.fn(async () => ({ status: "saved" })),
}));

const baseView: CaseNoteTabView = {
  viewerCanCreate: true,
  notes: [
    {
      id: "note_2",
      authorName: "Casey Coordinator",
      body: "Called the site about schedule concerns.",
      atLabel: "Jul 13, 2026, 9:00 AM",
      revisions: [
        {
          priorBody: "Called the site.",
          editorName: "Casey Coordinator",
          atLabel: "Jul 13, 2026, 9:05 AM",
        },
      ],
    },
    {
      id: "note_1",
      authorName: "Ari Admin",
      body: "Participant asked about bus routes.",
      atLabel: "Jul 12, 2026, 3:00 PM",
      revisions: [],
    },
  ],
};

describe("CaseNotesTab (Story 5.9)", () => {
  it("labels the surface internal-only and lists notes with author and timestamp", () => {
    render(<CaseNotesTab placementId="pl_1" caseNotes={baseView} />);

    expect(
      screen.getByText(/visible to Nova Operations only, never to shelters or participants/i),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Case notes" });
    expect(list).toBeInTheDocument();
    expect(
      screen.getByText("Called the site about schedule concerns."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Casey Coordinator · Jul 13, 2026, 9:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/Ari Admin · Jul 12, 2026, 3:00 PM/)).toBeInTheDocument();
  });

  it("marks edited notes and discloses the preserved earlier versions (AC5)", async () => {
    const user = userEvent.setup();
    render(<CaseNotesTab placementId="pl_1" caseNotes={baseView} />);

    expect(screen.getByText(/Edited \(1 earlier version\)/)).toBeInTheDocument();
    await user.click(screen.getByText("Show earlier versions"));
    expect(screen.getByText("Called the site.")).toBeInTheDocument();
    expect(
      screen.getByText(/Replaced by Casey Coordinator · Jul 13, 2026, 9:05 AM/),
    ).toBeInTheDocument();
  });

  it("offers the composer and edit controls only when the viewer can create", () => {
    render(
      <CaseNotesTab
        placementId="pl_1"
        caseNotes={{ ...baseView, viewerCanCreate: false }}
      />,
    );

    expect(screen.queryByLabelText("New internal note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Note" })).toBeNull();
    // The notes themselves still render for read-capable viewers.
    expect(
      screen.getByText("Participant asked about bus routes."),
    ).toBeInTheDocument();
  });

  it("opens an edit form pre-filled with the current body", async () => {
    const user = userEvent.setup();
    render(<CaseNotesTab placementId="pl_1" caseNotes={baseView} />);

    await user.click(screen.getAllByRole("button", { name: "Edit Note" })[0]);
    const editor = screen.getByLabelText("Edit note");
    expect(editor).toHaveValue("Called the site about schedule concerns.");
    expect(screen.getByRole("button", { name: "Save Edit" })).toBeInTheDocument();
  });
});
