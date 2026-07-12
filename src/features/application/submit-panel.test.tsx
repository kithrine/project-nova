import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MissingSubmissionItem } from "@/server/services/application-service";
import type { SubmitFormState } from "./actions";
import { SubmitPanel } from "./submit-panel";

const noopAction = async (): Promise<SubmitFormState> => ({ status: "idle" });

const missing: MissingSubmissionItem[] = [
  {
    kind: "field",
    label: "Why do you want to join Project Nova?",
    message: "This answer is still blank — a sentence or two is plenty.",
    anchor: "motivation",
  },
  {
    kind: "document",
    label: "Government-issued ID",
    message: "This document still needs to be uploaded.",
    anchor: "upload-GOVERNMENT_ID",
  },
];

describe("SubmitPanel (Story 2.5)", () => {
  it("disables Submit with the reason while items are missing", () => {
    render(
      <SubmitPanel updatedAtToken="t1" missingItems={missing} action={noopAction} />,
    );

    const button = screen.getByRole("button", { name: "Submit Application" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "submit-hint");
    expect(screen.getByText(/2 items left to finish/i)).toBeInTheDocument();
  });

  it("lists each missing item, linked to the control that resolves it", () => {
    render(
      <SubmitPanel updatedAtToken="t1" missingItems={missing} action={noopAction} />,
    );

    expect(
      screen.getByRole("link", { name: "Why do you want to join Project Nova?" }),
    ).toHaveAttribute("href", "#motivation");
    expect(
      screen.getByRole("link", { name: "Government-issued ID" }),
    ).toHaveAttribute("href", "#upload-GOVERNMENT_ID");
    expect(screen.getByText(/still needs to be uploaded/i)).toBeInTheDocument();
  });

  it("enables Submit when complete and states that submission is final", () => {
    render(<SubmitPanel updatedAtToken="t1" missingItems={[]} action={noopAction} />);

    expect(screen.getByRole("button", { name: "Submit Application" })).toBeEnabled();
    expect(screen.getByText(/can't be edited/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready when you are/i)).toBeInTheDocument();
  });

  it("carries the concurrency token for the atomic compare-and-set", () => {
    const { container } = render(
      <SubmitPanel updatedAtToken="2026-07-11T00:00:00.000Z" missingItems={[]} action={noopAction} />,
    );
    const token = container.querySelector('input[name="updatedAtToken"]');
    expect(token).toHaveAttribute("value", "2026-07-11T00:00:00.000Z");
  });

  it("renders the Concurrent update state with a reload path", () => {
    render(
      <SubmitPanel
        updatedAtToken="t1"
        missingItems={[]}
        action={noopAction}
        initialState={{
          status: "conflict",
          formError: "This application was updated somewhere else.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/changed somewhere else/i);
    expect(
      screen.getByRole("link", { name: "Reload Latest Version" }),
    ).toHaveAttribute("href", "/participant/application");
  });

  it("explains a replayed submit as already handled, not an error", () => {
    render(
      <SubmitPanel
        updatedAtToken="t1"
        missingItems={[]}
        action={noopAction}
        initialState={{
          status: "lifecycle",
          formError: "This application has already been submitted.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/already submitted/i);
  });
});
