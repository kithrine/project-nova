import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AuditReviewView } from "@/server/services/audit-service";

import { AuditReview } from "./audit-review";

function makeView(overrides: Partial<AuditReviewView> = {}): AuditReviewView {
  return {
    rows: [
      {
        id: "evt-1",
        actorName: "Ada Admin",
        action: "backgroundReview.view",
        subjectType: "Application",
        subjectId: "app-123",
        detail: null,
        atIso: "2026-07-10T14:00:00.000Z",
        atLabel: "Jul 10, 2026, 2:00 PM UTC",
      },
      {
        id: "evt-2",
        actorName: "Cory Coordinator",
        action: "timesheet.lock",
        subjectType: "Timesheet",
        subjectId: "ts-456",
        detail: "final for reporting: 12.34 hours",
        atIso: "2026-07-09T09:30:00.000Z",
        atLabel: "Jul 9, 2026, 9:30 AM UTC",
      },
    ],
    totalCount: 2,
    actorOptions: [
      { value: "u1", label: "Ada Admin" },
      { value: "u2", label: "Cory Coordinator" },
    ],
    actionOptions: ["backgroundReview.view", "timesheet.lock"],
    subjectTypeOptions: ["Application", "Timesheet"],
    applied: {
      actorUserId: null,
      action: null,
      subjectType: null,
      fromIso: null,
      toIso: null,
    },
    ...overrides,
  };
}

describe("AuditReview", () => {
  it("renders actor, action, resource reference, detail, and timestamp per event (AC1)", () => {
    render(<AuditReview view={makeView()} basePath="/operations/administration/audit" />);

    const table = screen.getByRole("table");
    const lockRow = within(table).getByText("timesheet.lock").closest("tr");
    expect(within(lockRow as HTMLElement).getByText("Cory Coordinator")).toBeInTheDocument();
    expect(within(lockRow as HTMLElement).getByText("Timesheet")).toBeInTheDocument();
    expect(within(lockRow as HTMLElement).getByText("ts-456")).toBeInTheDocument();
    expect(
      within(lockRow as HTMLElement).getByText("final for reporting: 12.34 hours"),
    ).toBeInTheDocument();
    expect(
      within(lockRow as HTMLElement).getByText("Jul 9, 2026, 9:30 AM UTC"),
    ).toBeInTheDocument();

    // A detail-less event renders a placeholder, never blank.
    const viewRow = within(table).getByText("backgroundReview.view").closest("tr");
    expect(within(viewRow as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("offers filter controls populated from the events (AC2)", () => {
    render(<AuditReview view={makeView()} basePath="/operations/administration/audit" />);

    const form = screen.getByRole("form", { name: "Audit filters" });
    expect(within(form).getByLabelText("Actor")).toBeInTheDocument();
    expect(
      within(form).getByRole("option", { name: "timesheet.lock" }),
    ).toBeInTheDocument();
    expect(
      within(form).getByRole("option", { name: "Application" }),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByText("2 audit events.")).toBeInTheDocument();
  });

  it("notes truncation when more events match than are shown", () => {
    render(
      <AuditReview
        view={makeView({ totalCount: 250 })}
        basePath="/operations/administration/audit"
      />,
    );
    expect(
      screen.getByText("250 audit events — showing the 2 most recent."),
    ).toBeInTheDocument();
  });

  it("renders the empty state without a table", () => {
    render(
      <AuditReview
        view={makeView({ rows: [], totalCount: 0 })}
        basePath="/operations/administration/audit"
      />,
    );
    expect(screen.getByText("No audit events match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
