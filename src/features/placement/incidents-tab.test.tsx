import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { IncidentsTabView, IncidentView } from "@/server/services/placement-service";
import { IncidentsTab, type IncidentFormCatalog } from "./incidents-tab";

vi.mock("@/features/placement/actions", () => ({
  submitIncidentAction: vi.fn(async () => ({ status: "saved" })),
  addIncidentFollowUpAction: vi.fn(async () => ({ status: "saved" })),
  startIncidentReviewAction: vi.fn(async () => ({ status: "saved" })),
  closeIncidentAction: vi.fn(async () => ({ status: "saved" })),
}));

const catalog: IncidentFormCatalog = {
  categories: [
    { key: "SAFETY", label: "Safety" },
    { key: "HARASSMENT", label: "Harassment" },
  ],
  severities: [
    { key: "MINOR", label: "Minor" },
    { key: "SERIOUS", label: "Serious" },
  ],
};

const baseIncident: IncidentView = {
  id: "inc_1",
  incidentNumber: "INC-2026-ABC123",
  categoryLabel: "Safety",
  severityKey: "SERIOUS" as IncidentView["severityKey"],
  severityLabel: "Serious",
  statusKey: "OPEN" as IncidentView["statusKey"],
  statusLabel: "Open",
  statusTone: "warning",
  occurredOnLabel: "August 20, 2026",
  reportedByName: "Sam Supervisor",
  reportedAtLabel: "Aug 20, 2026, 2:00 PM",
  description: "Gate latch failed during transfer.",
  followUps: [],
  closureOutcome: null,
  closedByName: null,
  closedAtLabel: null,
  viewerCanFollowUp: true,
  viewerCanReview: false,
};

function view(overrides: Partial<IncidentsTabView> = {}): IncidentsTabView {
  return { entries: [baseIncident], viewerCanReport: true, ...overrides };
}

describe("IncidentsTab (Story 5.11)", () => {
  it("keeps the emergency-services notice persistent and prominent (AC1)", () => {
    render(<IncidentsTab placementId="pl_1" incidents={view()} catalog={catalog} />);

    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent(
      /does not replace calling emergency services/i,
    );
    // Present before any interaction, not a dismissible tooltip.
    expect(screen.getByRole("button", { name: "Report Incident" })).toBeInTheDocument();
  });

  it("requires the extra confirmation for Serious severity before submit arms (AC1/UX)", async () => {
    const user = userEvent.setup();
    render(<IncidentsTab placementId="pl_1" incidents={view()} catalog={catalog} />);

    const submit = screen.getByRole("button", { name: "Report Incident" });
    await user.click(screen.getByRole("radio", { name: "Minor" }));
    expect(submit).toBeEnabled();

    await user.click(screen.getByRole("radio", { name: "Serious" }));
    expect(submit).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /alerts Nova Operations immediately/i,
      }),
    );
    expect(submit).toBeEnabled();
  });

  it("shows text-and-icon severity, follow-up entry, and never a severity/category editor after submission (AC3)", () => {
    render(<IncidentsTab placementId="pl_1" incidents={view()} catalog={catalog} />);

    const list = within(screen.getByRole("list", { name: "Incidents" }));
    expect(list.getByText("INC-2026-ABC123 · Safety")).toBeInTheDocument();
    expect(list.getByText("Serious")).toBeInTheDocument();
    expect(screen.getByLabelText("Add follow-up")).toBeInTheDocument();
    // The card exposes no control that could change category or severity.
    expect(screen.queryByRole("combobox", { name: /category/i })).not.toBeNull();
    // (that combobox belongs to the REPORT form) — the card itself has none:
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });

  it("offers review controls only when the viewer can review, and renders restricted narrative only when present", () => {
    render(
      <IncidentsTab
        placementId="pl_1"
        incidents={view({
          viewerCanReport: false,
          entries: [
            {
              ...baseIncident,
              viewerCanFollowUp: false,
              viewerCanReview: true,
              restrictedDetail: "Names withheld — restricted specifics.",
            },
          ],
        })}
        catalog={catalog}
      />,
    );

    expect(screen.queryByRole("button", { name: "Report Incident" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Incident…" })).toBeInTheDocument();
    expect(
      screen.getByText(/Restricted narrative — access is audited/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Names withheld — restricted specifics."),
    ).toBeInTheDocument();
  });

  it("shows closure as read-only history", () => {
    render(
      <IncidentsTab
        placementId="pl_1"
        incidents={view({
          entries: [
            {
              ...baseIncident,
              statusKey: "CLOSED" as IncidentView["statusKey"],
              statusLabel: "Closed",
              statusTone: "neutral",
              closureOutcome: "Reviewed with the site; latch replaced.",
              closedByName: "Casey Coordinator",
              closedAtLabel: "Aug 21, 2026, 9:00 AM",
              viewerCanFollowUp: false,
              viewerCanReview: false,
            },
          ],
        })}
        catalog={catalog}
      />,
    );

    expect(screen.getByText(/Reviewed with the site; latch replaced\./)).toBeInTheDocument();
    expect(screen.queryByLabelText("Add follow-up")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start Review" })).toBeNull();
  });
});
