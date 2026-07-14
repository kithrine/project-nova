import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WeekDayView } from "@/server/services/timesheet-service";
import { WorkEntryEditor } from "./work-entry-editor";

vi.mock("@/features/timesheets/actions", () => ({
  addWorkEntryAction: vi.fn(async () => ({ status: "saved" })),
  updateWorkEntryAction: vi.fn(async () => ({ status: "saved" })),
  removeWorkEntryAction: vi.fn(async () => ({ status: "saved" })),
}));

const days: WeekDayView[] = [
  {
    dateIso: "2026-07-13",
    dayLabel: "Monday, July 13",
    entries: [
      {
        id: "we_1",
        startTime: "08:00",
        endTime: "16:15",
        breakMinutes: 30,
        hours: "7.75",
        note: "Kennel rotation",
      },
    ],
  },
  { dateIso: "2026-07-14", dayLabel: "Tuesday, July 14", entries: [] },
];

describe("WorkEntryEditor (Story 6.2)", () => {
  it("lists entries under their day with server-computed hours and labeled add form", () => {
    render(<WorkEntryEditor timesheetId="ts_1" days={days} editable />);

    expect(
      screen.getByRole("heading", { name: "Monday, July 13" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/08:00–16:15 · 30 min break ·/)).toBeInTheDocument();
    expect(screen.getByText("7.75 hours")).toBeInTheDocument();
    expect(screen.getByText("Kennel rotation")).toBeInTheDocument();
    // The add form's inputs are labeled — no hours field exists anywhere.
    expect(screen.getByLabelText("Day")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeRequired();
    expect(screen.getByLabelText("End time")).toBeRequired();
    expect(screen.getByLabelText("Unpaid break (minutes)")).toBeInTheDocument();
    expect(screen.queryByLabelText(/hours/i)).toBeNull();
  });

  it("opens an edit form pre-filled from the entry", async () => {
    const user = userEvent.setup();
    render(<WorkEntryEditor timesheetId="ts_1" days={days} editable />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save Entry" })).toBeInTheDocument();
    const starts = screen.getAllByLabelText("Start time");
    expect(starts[0]).toHaveValue("08:00");
  });

  it("renders read-only when the timesheet is not participant-editable (AC2 shape)", () => {
    render(<WorkEntryEditor timesheetId="ts_1" days={days} editable={false} />);

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByText("Add a work day")).toBeNull();
    expect(screen.getByText("7.75 hours")).toBeInTheDocument();
  });

  it("shows the honest empty states", () => {
    const empty = days.map((day) => ({ ...day, entries: [] }));
    const { rerender } = render(
      <WorkEntryEditor timesheetId="ts_1" days={empty} editable />,
    );
    expect(
      screen.getByText(/No hours recorded yet — add your first work day below/),
    ).toBeInTheDocument();
    rerender(<WorkEntryEditor timesheetId="ts_1" days={empty} editable={false} />);
    expect(
      screen.getByText("No hours were recorded for this week."),
    ).toBeInTheDocument();
  });
});
