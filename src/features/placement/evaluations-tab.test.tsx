import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EvaluationsTabView } from "@/server/services/placement-service";
import { EvaluationsTab, type EvaluationFormCatalog } from "./evaluations-tab";

vi.mock("@/features/placement/actions", () => ({
  submitEvaluationAction: vi.fn(async () => ({ status: "saved" })),
}));

const catalog: EvaluationFormCatalog = {
  areas: [
    { key: "reliability", label: "Reliability and attendance" },
    { key: "taskQuality", label: "Task quality and safety" },
    { key: "teamwork", label: "Teamwork and communication" },
  ],
  ratings: [
    { key: "NEEDS_SUPPORT", label: "Needs support" },
    { key: "MEETS_EXPECTATIONS", label: "Meets expectations" },
  ],
};

const submitted: EvaluationsTabView = {
  viewerCanSubmit: true,
  entries: [
    {
      id: "ev_1",
      authorName: "Sam Supervisor",
      evaluationDateLabel: "August 15, 2026",
      submittedAtLabel: "Aug 15, 2026, 4:00 PM",
      ratings: [
        { areaLabel: "Reliability and attendance", ratingLabel: "Meets expectations" },
        { areaLabel: "Task quality and safety", ratingLabel: "Needs support" },
      ],
      strengths: "Great with intake paperwork.",
      growthAreas: "Kennel safety checks.",
    },
  ],
};

describe("EvaluationsTab (Story 5.10)", () => {
  it("renders the form with labeled rating scales per performance area", () => {
    render(
      <EvaluationsTab placementId="pl_1" evaluations={submitted} catalog={catalog} />,
    );

    for (const area of catalog.areas) {
      const group = screen.getByRole("group", { name: area.label });
      expect(group).toBeInTheDocument();
    }
    // Ratings are text-labeled radios, never bare numbers or colors.
    expect(
      screen.getAllByRole("radio", { name: "Meets expectations" }),
    ).toHaveLength(3);
    expect(screen.getByLabelText("What went well")).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Submit Evaluation" }),
    ).toBeInTheDocument();
  });

  it("lists past evaluations with author, dates, and labeled ratings", () => {
    render(
      <EvaluationsTab placementId="pl_1" evaluations={submitted} catalog={catalog} />,
    );

    const list = screen.getByRole("list", { name: "Evaluations" });
    expect(list).toBeInTheDocument();
    expect(screen.getByText("Evaluation for August 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("Great with intake paperwork.")).toBeInTheDocument();
    expect(screen.getByText("Kennel safety checks.")).toBeInTheDocument();
    expect(screen.getByText(/Sam Supervisor · submitted/)).toBeInTheDocument();
  });

  it("renders read-only for viewers who cannot submit (Nova Operations)", () => {
    render(
      <EvaluationsTab
        placementId="pl_1"
        evaluations={{ ...submitted, viewerCanSubmit: false }}
        catalog={catalog}
      />,
    );

    expect(screen.queryByRole("button", { name: "Submit Evaluation" })).toBeNull();
    expect(screen.getByText("Great with intake paperwork.")).toBeInTheDocument();
  });
});
