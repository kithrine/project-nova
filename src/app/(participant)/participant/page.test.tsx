import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "@/server/auth/context";
import type { ParticipantPlacementView } from "@/server/services/placement-service";
import ParticipantDashboardPage from "./page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/context", () => ({ getOrProvisionAuthContext: vi.fn() }));
vi.mock("@/server/services/applicant-onboarding", () => ({ getOwnPerson: vi.fn() }));
vi.mock("@/server/services/enrollment-service", () => ({
  getOwnOnboardingSummary: vi.fn(),
}));
vi.mock("@/server/services/matching-service", () => ({
  getOwnProposedMatch: vi.fn(),
  getOwnDeclinedPlacementNotice: vi.fn(),
}));
vi.mock("@/server/services/readiness-service", () => ({ getOwnReadiness: vi.fn() }));
vi.mock("@/server/services/training-service", () => ({
  getOwnTrainingJourney: vi.fn(),
}));
vi.mock("@/server/services/placement-service", () => ({ getOwnPlacement: vi.fn() }));
vi.mock("@/server/services/timesheet-service", () => ({
  getOwnCurrentWeekHours: vi.fn(),
}));
vi.mock("@/server/services/certification-service", () => ({
  getOwnCertifications: vi.fn(),
}));

import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";
import { getOwnCertifications } from "@/server/services/certification-service";
import { getOwnOnboardingSummary } from "@/server/services/enrollment-service";
import {
  getOwnDeclinedPlacementNotice,
  getOwnProposedMatch,
} from "@/server/services/matching-service";
import { getOwnPlacement } from "@/server/services/placement-service";
import { getOwnReadiness } from "@/server/services/readiness-service";
import { getOwnCurrentWeekHours } from "@/server/services/timesheet-service";
import { getOwnTrainingJourney } from "@/server/services/training-service";

const ctx = {
  userId: "user_1",
  email: "harper@example.com",
  displayName: "Harper",
  memberships: [{ organizationId: "org_nova", role: "PARTICIPANT" }],
} as unknown as AuthContext;

const person = {
  id: "person_1",
  legalFirstName: "Harper",
  legalLastName: "Example",
};

function placedView(
  overrides: Partial<ParticipantPlacementView> = {},
): ParticipantPlacementView {
  return {
    placementNumber: "PLC-2026-HARPER1",
    organizationName: "Riverbend Animal Shelter",
    siteName: "Main Campus",
    siteLocation: "Denver, CO",
    stageLabel: "Active",
    stageBody: "Your placement is underway. Your schedule and supervisor are below.",
    scheduleSummary: "Tue/Thu mornings",
    startDateLabel: "June 1, 2026",
    supervisorName: "Sam Supervisor",
    active: true,
    mySteps: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getOrProvisionAuthContext).mockResolvedValue(ctx);
  vi.mocked(getOwnPerson).mockResolvedValue(person as never);
  vi.mocked(getOwnOnboardingSummary).mockResolvedValue(null);
  vi.mocked(getOwnTrainingJourney).mockResolvedValue(null);
  vi.mocked(getOwnReadiness).mockResolvedValue(null);
  vi.mocked(getOwnProposedMatch).mockResolvedValue(null);
  vi.mocked(getOwnDeclinedPlacementNotice).mockResolvedValue(null);
  vi.mocked(getOwnPlacement).mockResolvedValue(null);
  vi.mocked(getOwnCurrentWeekHours).mockResolvedValue(null);
  vi.mocked(getOwnCertifications).mockResolvedValue([]);
});

describe("participant home placed state", () => {
  it("shows placement tiles, not the applicant card, for a placed participant", async () => {
    vi.mocked(getOwnPlacement).mockResolvedValue(placedView());
    vi.mocked(getOwnCurrentWeekHours).mockResolvedValue({
      weekLabel: "Week of July 20, 2026",
      totalHours: "12.50",
      statusLabel: "Approved",
    });
    vi.mocked(getOwnCertifications).mockResolvedValue([{ id: "c1" }, { id: "c2" }] as never);

    render(await ParticipantDashboardPage());

    expect(screen.getByText("Main Campus")).toBeInTheDocument();
    expect(screen.getByText("12.50")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Placement" })).toHaveAttribute(
      "href",
      "/participant/placement",
    );
    // The vetted stage copy frames the page instead of applicant copy.
    expect(screen.getByText(/Your placement is underway/)).toBeInTheDocument();
    expect(screen.queryByText(/your account is set up/)).not.toBeInTheDocument();
    expect(screen.queryByText(/application is the next step/)).not.toBeInTheDocument();
  });

  it("keeps the applicant welcome card for a participant with no placement", async () => {
    render(await ParticipantDashboardPage());

    expect(screen.getByText(/your account is set up/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue to My Application" }),
    ).toBeInTheDocument();
  });

  it("does not treat terminal placement history as a placed state", async () => {
    vi.mocked(getOwnPlacement).mockResolvedValue(
      placedView({ active: false, stageLabel: "Ended" }),
    );

    render(await ParticipantDashboardPage());

    expect(screen.queryByText("Main Campus")).not.toBeInTheDocument();
    expect(screen.getByText(/your account is set up/)).toBeInTheDocument();
  });
});
