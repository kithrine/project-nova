import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ParticipantProposedCard,
  ShelterApprovalCard,
} from "./proposed-placement-card";

describe("ParticipantProposedCard (Story 4.4, AC3)", () => {
  const match = {
    id: "match_1",
    organizationName: "Sunny Paws Shelter",
    siteName: "Main Site",
    siteLocation: "Springfield, WA",
    schedule: "Mon/Wed/Fri mornings",
    startDateLabel: "August 3, 2026",
    endDateLabel: "December 4, 2026",
    respondByLabel: "July 27, 2026",
  };

  it("announces the proposal in warm, plain language", () => {
    render(<ParticipantProposedCard match={match} />);

    expect(
      screen.getByRole("heading", { name: "A placement has been proposed for you" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A placement has been proposed for you.",
    );
    expect(screen.getByText(/Sunny Paws Shelter — Main Site, Springfield, WA/)).toBeInTheDocument();
    expect(screen.getByText("Mon/Wed/Fri mornings")).toBeInTheDocument();
    expect(screen.getByText(/August 3, 2026 – December 4, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/through July 27, 2026/)).toBeInTheDocument();
  });

  it("carries no coordinator or restricted content and no decision controls yet", () => {
    const { container } = render(<ParticipantProposedCard match={match} />);

    expect(container.textContent).not.toMatch(/coordinator note|compatibility|score/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/your coordinator is glad to talk it through/i)).toBeInTheDocument();
  });
});

describe("ShelterApprovalCard (Story 4.4, AC4)", () => {
  const match = {
    id: "match_1",
    participantName: "Quinn Example",
    siteName: "Main Site",
    supervisorName: "Sam Supervisor",
    schedule: "Mon/Wed/Fri mornings",
    startDateLabel: "August 3, 2026",
    endDateLabel: "December 4, 2026",
    respondByLabel: "July 27, 2026",
    statusLabel: "Proposed",
  };

  it("shows the operational details for the shelter's own proposal", () => {
    render(
      <ul>
        <ShelterApprovalCard match={match} />
      </ul>,
    );

    expect(screen.getByText("Quinn Example")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText("Supervisor: Sam Supervisor")).toBeInTheDocument();
    expect(screen.getByText("Schedule: Mon/Wed/Fri mornings")).toBeInTheDocument();
    expect(screen.getByText("Respond by July 27, 2026")).toBeInTheDocument();
  });

  it("includes no coordinator-internal or restricted content", () => {
    const { container } = render(
      <ul>
        <ShelterApprovalCard match={match} />
      </ul>,
    );
    expect(container.textContent).not.toMatch(/coordinator note|compatibility|background/i);
  });
});
