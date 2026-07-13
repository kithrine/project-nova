import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlacementStatus } from "@/generated/prisma/client";
import type { PlacementWorkspaceView } from "@/server/services/placement-service";
import { AssignmentForm } from "./assignment-form";

const baseView: PlacementWorkspaceView = {
  viewer: "NOVA",
  id: "pl_1",
  placementNumber: "PLC-2026-TEST01",
  status: PlacementStatus.DRAFT,
  statusLabel: "Draft",
  isTerminal: false,
  participantName: "Quinn Example",
  organizationName: "Sunny Paws",
  siteName: "Main",
  siteLocation: null,
  supervisorName: null,
  coordinatorName: null,
  scheduleSummary: null,
  startDateLabel: null,
  endDateLabel: null,
  fundingSummary: null,
  tabs: ["overview", "schedule"],
  timeline: [],
  history: [],
  structuredSchedule: null,
  shelterReviewNote: null,
  packageMissing: ["Supervisor", "Coordinator of record", "Work schedule"],
  assignmentOptions: {
    siteOptions: [{ id: "site_1", label: "Main" }],
    supervisorOptions: [{ id: "u_sup", label: "Sam Supervisor" }],
    coordinatorOptions: [{ id: "u_pc", label: "Casey Coordinator" }],
  },
  viewerCanApprovePackage: false,
  siteId: "site_1",
  supervisorId: null,
  coordinatorUserId: null,
  funding: { active: null, history: [], viewerCanAssign: false, sourceOptions: [] },
  onboarding: {
    tasks: [],
    requiredRemaining: 0,
    canInitiate: false,
    viewerCanCompleteAllTasks: false,
    viewerCanCompleteShelterTasks: false,
  },
};

describe("AssignmentForm (Story 5.2)", () => {
  it("names the organization scope on selects and the missing pieces on propose", () => {
    render(<AssignmentForm view={baseView} />);

    expect(
      screen.getByText(/this host organization's active sites/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/active supervisors and managers at this organization/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete these first: Supervisor; Coordinator of record; Work schedule.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Propose to Shelter" })).toBeDisabled();
  });

  it("reveals keyboard-operable time inputs when a day is enabled", async () => {
    const user = userEvent.setup();
    render(<AssignmentForm view={baseView} />);

    expect(screen.queryByLabelText("Start")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Monday"));
    expect(screen.getAllByLabelText("Start")).toHaveLength(1);
    expect(screen.getAllByLabelText("End")).toHaveLength(1);
  });

  it("enables propose when the package is complete", () => {
    render(
      <AssignmentForm
        view={{
          ...baseView,
          packageMissing: [],
          supervisorId: "u_sup",
          coordinatorUserId: "u_pc",
          structuredSchedule: {
            days: [
              { day: "MONDAY", dayLabel: "Monday", startTime: "09:00", endTime: "13:00" },
            ],
            weeklyHoursTarget: "8",
          },
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Propose to Shelter" })).toBeEnabled();
  });
});
