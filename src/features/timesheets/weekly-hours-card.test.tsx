import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimesheetStatus } from "@/generated/prisma/client";
import type { MyHoursWeekView } from "@/server/services/timesheet-service";
import { WeeklyHoursCard } from "./weekly-hours-card";

function week(overrides: Partial<MyHoursWeekView> = {}): MyHoursWeekView {
  return {
    timesheetId: "ts_1",
    weekStartIso: "2026-07-13",
    weekLabel: "Week of July 13, 2026",
    statusKey: TimesheetStatus.DRAFT,
    statusLabel: "Draft",
    totalHours: "0.00",
    editable: true,
    blockedReason: null,
    isCurrentWeek: true,
    previousWeekIso: "2026-07-06",
    nextWeekIso: null,
    days: [],
    ...overrides,
  };
}

describe("WeeklyHoursCard (Story 6.1)", () => {
  it("renders the fresh empty DRAFT week with status in text", () => {
    render(<WeeklyHoursCard week={week()} siteName="Main Site (Synthetic)" />);

    expect(screen.getByText("Week of July 13, 2026")).toBeInTheDocument();
    expect(screen.getByText("Hours at Main Site (Synthetic)")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("0.00")).toBeInTheDocument();
    expect(screen.getByText(/No hours recorded yet/)).toBeInTheDocument();
    // Current week: previous is a link, next is not navigable.
    expect(screen.getByRole("link", { name: "← Previous week" })).toHaveAttribute(
      "href",
      "/participant/hours?week=2026-07-06",
    );
    expect(screen.queryByRole("link", { name: "Next week →" })).toBeNull();
    expect(screen.getByText("This is the current week")).toBeInTheDocument();
  });

  it("renders an existing week with hours and both navigation links", () => {
    render(
      <WeeklyHoursCard
        week={week({
          totalHours: "12.50",
          isCurrentWeek: false,
          nextWeekIso: "2026-07-20",
          days: [
            {
              dateIso: "2026-07-13",
              dayLabel: "Monday, July 13",
              entries: [
                {
                  id: "we_1",
                  startTime: "08:00",
                  endTime: "20:30",
                  breakMinutes: 0,
                  hours: "12.50",
                  note: null,
                },
              ],
            },
          ],
        })}
        siteName={null}
      />,
    );

    expect(screen.getByText("12.50", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/No hours recorded yet/)).toBeNull();
    expect(screen.getByRole("link", { name: "Next week →" })).toHaveAttribute(
      "href",
      "/participant/hours?week=2026-07-20",
    );
  });

  it("explains a blocked week instead of pretending a timesheet exists (AC4/AC5)", () => {
    render(
      <WeeklyHoursCard
        week={week({
          timesheetId: null,
          statusKey: null,
          statusLabel: null,
          totalHours: null,
          editable: false,
          blockedReason: "Hours can't be recorded for a future week.",
        })}
        siteName={null}
      />,
    );

    expect(
      screen.getByText("Hours can't be recorded for a future week."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Status:/)).toBeNull();
  });
});
