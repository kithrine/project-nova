import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TimesheetStatus } from "@/generated/prisma/client";
import type { TimesheetReviewView } from "@/server/services/timesheet-service";
import { TimesheetReviewCard } from "./timesheet-review-card";

vi.mock("@/features/timesheets/actions", () => ({
  approveTimesheetAction: vi.fn(async () => ({ status: "saved" })),
  rejectTimesheetAction: vi.fn(async () => ({ status: "saved" })),
}));

function review(overrides: Partial<TimesheetReviewView> = {}): TimesheetReviewView {
  return {
    timesheetId: "ts_1",
    placementId: "pl_1",
    participantName: "Harper Synthetic-Hours",
    placementNumber: "PLC-E2E-HARPER1",
    siteName: "Main Site",
    weekLabel: "Week of July 6, 2026",
    statusKey: TimesheetStatus.SUBMITTED,
    statusLabel: "Submitted",
    totalHours: "7.75",
    days: [
      {
        dateIso: "2026-07-06",
        dayLabel: "Monday, July 6",
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
    ],
    submittedAtLabel: "Jul 10, 2026, 5:00 PM",
    approvedAtLabel: null,
    approvedByName: null,
    rejectedAtLabel: null,
    rejectedByName: null,
    rejectionReason: null,
    lockedAtLabel: null,
    lockedByName: null,
    viewerCanApprove: true,
    viewerCanReject: true,
    viewerCanLock: false,
    ...overrides,
  };
}

describe("TimesheetReviewCard (Story 6.5)", () => {
  it("shows the week read-only with entries, total, and status in text", () => {
    render(<TimesheetReviewCard review={review()} />);

    expect(
      screen.getByText("Harper Synthetic-Hours — Week of July 6, 2026"),
    ).toBeInTheDocument();
    expect(screen.getByText(/08:00–16:15 · 30 min break ·/)).toBeInTheDocument();
    expect(screen.getByText("7.75 hours")).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toHaveTextContent(
      "Status: Submitted · submitted Jul 10, 2026, 5:00 PM",
    );
    // Read-only: no entry inputs anywhere.
    expect(screen.queryByLabelText("Start time")).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit|Remove/ })).toBeNull();
  });

  it("confirms approval explicitly — never inferred from viewing", async () => {
    const user = userEvent.setup();
    render(<TimesheetReviewCard review={review()} />);

    await user.click(screen.getByRole("button", { name: "Approve Hours…" }));
    expect(
      screen.getByText(/Approve this week's hours as recorded\?/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Yes, Approve Hours" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Approve Hours…" })).toBeInTheDocument();
  });

  it("withholds the approve control without standing, and shows the approval record after", () => {
    render(
      <TimesheetReviewCard
        review={review({
          viewerCanApprove: false,
          statusKey: TimesheetStatus.APPROVED,
          statusLabel: "Approved",
          approvedAtLabel: "Jul 11, 2026, 9:00 AM",
          approvedByName: "Synthetic E2E Shelter",
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /Approve Hours/ })).toBeNull();
    expect(
      screen.getByText("Approved by Synthetic E2E Shelter · Jul 11, 2026, 9:00 AM"),
    ).toBeInTheDocument();
  });
});
