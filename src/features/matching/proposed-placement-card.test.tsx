import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  ParticipantDeclinedNotice,
  ParticipantProposedCard,
  ShelterApprovalCard,
} from "./proposed-placement-card";

const pendingMatch = {
  id: "match_1",
  organizationName: "Sunny Paws Shelter",
  siteName: "Main Site",
  siteLocation: "Springfield, WA",
  schedule: "Mon/Wed/Fri mornings",
  startDateLabel: "August 3, 2026",
  endDateLabel: "December 4, 2026",
  respondByLabel: "July 27, 2026",
  participantDecision: "PENDING" as const,
  revising: false,
};

describe("ParticipantProposedCard (Stories 4.4/4.5)", () => {
  it("announces the proposal in warm, plain language", () => {
    render(<ParticipantProposedCard match={pendingMatch} />);

    expect(
      screen.getByRole("heading", { name: "A placement has been proposed for you" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A placement has been proposed for you.",
    );
    expect(
      screen.getByText(/Sunny Paws Shelter — Main Site, Springfield, WA/),
    ).toBeInTheDocument();
    expect(screen.getByText("Mon/Wed/Fri mornings")).toBeInTheDocument();
    expect(screen.getByText(/August 3, 2026 – December 4, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/through July 27, 2026/)).toBeInTheDocument();
  });

  it("offers Accept and Decline while the decision is pending (4.5)", () => {
    render(<ParticipantProposedCard match={pendingMatch} />);

    expect(
      screen.getByRole("button", { name: "Accept This Placement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decline This Placement" }),
    ).toBeInTheDocument();
  });

  it("confirms an accept before anything is submitted, with a way back", async () => {
    const user = userEvent.setup();
    render(<ParticipantProposedCard match={pendingMatch} />);

    await user.click(screen.getByRole("button", { name: "Accept This Placement" }));
    expect(
      screen.getByText(/You're accepting this placement at Sunny Paws Shelter/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Yes, Accept This Placement" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(
      screen.getByRole("button", { name: "Accept This Placement" }),
    ).toBeInTheDocument();
  });

  it("offers an optional, non-interrogative note on the decline confirmation", async () => {
    const user = userEvent.setup();
    render(<ParticipantProposedCard match={pendingMatch} />);

    await user.click(screen.getByRole("button", { name: "Decline This Placement" }));
    expect(
      screen.getByText(/You're declining this placement at Sunny Paws Shelter/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Anything you'd like us to know? (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/this is your choice to make/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Yes, Decline This Placement" }),
    ).toBeInTheDocument();
  });

  it("renders the accepted waiting state with no further actions (AC1)", () => {
    render(
      <ParticipantProposedCard
        match={{ ...pendingMatch, participantDecision: "ACCEPTED" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "You accepted this placement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "You accepted this placement.",
    );
    expect(screen.getByText(/nothing more is needed from you right now/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows plain revising language with no controls and no shelter wording (4.7 AC4)", () => {
    const { container } = render(
      <ParticipantProposedCard match={{ ...pendingMatch, revising: true }} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "We're adjusting a detail on your proposed placement",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing is needed from you right now/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // The shelter's internal operational note never surfaces here.
    expect(container.textContent).not.toMatch(/note|change request/i);
  });

  it("carries no coordinator or restricted content in either state", () => {
    const { container, unmount } = render(
      <ParticipantProposedCard match={pendingMatch} />,
    );
    expect(container.textContent).not.toMatch(/coordinator note|compatibility|score/i);
    unmount();

    const accepted = render(
      <ParticipantProposedCard
        match={{ ...pendingMatch, participantDecision: "ACCEPTED" }}
      />,
    );
    expect(accepted.container.textContent).not.toMatch(
      /coordinator note|compatibility|score/i,
    );
  });
});

describe("ParticipantDeclinedNotice (Story 4.5, AC2)", () => {
  it("uses respectful, plain decline language — never Rejected or Failed", () => {
    const { container } = render(
      <ParticipantDeclinedNotice notice={{ organizationName: "Sunny Paws Shelter" }} />,
    );

    expect(
      screen.getByRole("heading", { name: "You declined this placement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "You declined this placement.",
    );
    expect(
      screen.getByText(/you may be matched with another opportunity/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/rejected|failed/i);
  });
});

describe("ShelterApprovalCard (Stories 4.4/4.6)", () => {
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
    shelterDecision: "PENDING" as const,
    shelterDecisionLabel: "Pending",
    viewerCanDecide: true,
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

  it("offers the manager the three verb-first actions while pending (4.6)", () => {
    render(
      <ul>
        <ShelterApprovalCard match={match} />
      </ul>,
    );

    expect(screen.getByRole("button", { name: "Approve Placement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline Placement" })).toBeInTheDocument();
  });

  it("requires a note before Request Changes can be confirmed (AC2)", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <ShelterApprovalCard match={match} />
      </ul>,
    );

    await user.click(screen.getByRole("button", { name: "Request Changes" }));
    expect(
      screen.getByText("Request changes to this placement?"),
    ).toBeInTheDocument();
    const note = screen.getByLabelText("Note for the coordinator (required)");
    expect(note).toBeRequired();
    expect(screen.getByRole("button", { name: "Yes, Request Changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(screen.getByRole("button", { name: "Approve Placement" })).toBeInTheDocument();
  });

  it("renders the visible read-only state for a Shelter Supervisor (AC4)", () => {
    render(
      <ul>
        <ShelterApprovalCard match={{ ...match, viewerCanDecide: false }} />
      </ul>,
    );

    expect(
      screen.getByText(/Read-only — your Shelter Manager records the decision/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the recorded decision with text + icon once decided (AC1)", () => {
    render(
      <ul>
        <ShelterApprovalCard
          match={{
            ...match,
            shelterDecision: "APPROVED",
            shelterDecisionLabel: "Approved",
          }}
        />
      </ul>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Your decision: Approved/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
