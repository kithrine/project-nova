import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { QueueCandidateView } from "@/server/services/matching-service";
import { QueueCandidates, QueueHosts } from "./queue-lists";

const awaiting: QueueCandidateView = {
  enrollmentId: "enr_1",
  participantId: "part_1",
  participantName: "Quinn Example",
  programName: "Transitional Employment Program",
  readySinceLabel: "Jul 1, 2026",
  waitingDays: 11,
  availability: "Weekday mornings",
  state: "AWAITING_MATCH",
  blockerLabels: [],
};

const inProgress: QueueCandidateView = {
  ...awaiting,
  enrollmentId: "enr_2",
  participantName: "Morgan Example",
  state: "MATCH_IN_PROGRESS",
};

const sites = [{ id: "site_1", label: "Shelter A — Main (capacity 3)" }];

describe("QueueCandidates (Story 4.1)", () => {
  it("renders awaiting candidates with readiness, waiting time, and availability", () => {
    render(<QueueCandidates candidates={[awaiting]} siteOptions={sites} />);

    expect(
      screen.getByRole("list", { name: "Participants awaiting match" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quinn Example")).toBeInTheDocument();
    expect(screen.getByText(/Ready since Jul 1, 2026 · waiting 11 days/)).toBeInTheDocument();
    expect(screen.getByText("Availability: Weekday mornings")).toBeInTheDocument();
    expect(screen.getByText("Awaiting match")).toBeInTheDocument();
  });

  it("marks in-progress matches with text + icon and offers them no pairing form (AC2)", () => {
    render(<QueueCandidates candidates={[inProgress]} siteOptions={sites} />);

    expect(screen.getByText("Match in progress")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the pairing action per participant, keyboard-reachable (AC5)", () => {
    render(<QueueCandidates candidates={[awaiting]} siteOptions={sites} />);

    expect(screen.getByLabelText("Candidate shelter site")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Pairing: Quinn Example" }),
    ).toBeInTheDocument();
  });

  it("surfaces re-emerged blockers carried over from 3.6", () => {
    render(
      <QueueCandidates
        candidates={[{ ...awaiting, blockerLabels: ["Pet CPR"] }]}
        siteOptions={sites}
      />,
    );
    expect(screen.getByText(/Re-emerged blockers: Pet CPR/)).toBeInTheDocument();
  });

  it("shows the explicit empty state", () => {
    render(<QueueCandidates candidates={[]} siteOptions={sites} />);
    expect(
      screen.getByText(/No participants are ready for matching right now/),
    ).toBeInTheDocument();
  });
});

describe("QueueHosts (Story 4.1)", () => {
  it("lists hosts and their sites with capacity", () => {
    render(
      <QueueHosts
        hosts={[
          {
            organizationId: "org_1",
            name: "Shelter A",
            sites: [{ id: "site_1", name: "Main", capacity: 3 }],
          },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Shelters with capacity" })).toBeInTheDocument();
    expect(screen.getByText("Main — capacity 3")).toBeInTheDocument();
  });

  it("shows the explicit no-capacity empty state", () => {
    render(<QueueHosts hosts={[]} />);
    expect(screen.getByText(/No shelter sites currently have capacity/)).toBeInTheDocument();
  });
});
