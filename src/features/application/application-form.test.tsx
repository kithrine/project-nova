import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationStatus } from "@/generated/prisma/client";
import type { ApplicationView } from "@/server/services/application-service";
import type { DraftFormState } from "./actions";
import { ApplicationForm } from "./application-form";

const application: ApplicationView = {
  id: "app_1",
  applicationNumber: "APP-2026-XYZ789",
  status: ApplicationStatus.DRAFT,
  statusLabel: "In progress",
  motivation: "A steady job that matters.",
  workExperience: null,
  animalExperience: null,
  availabilityNotes: null,
  transportationNotes: null,
  progressPercent: 20,
  updatedAtToken: "2026-07-02T03:04:05.678Z",
};

const noopAction = async (): Promise<DraftFormState> => ({ status: "idle" });

describe("ApplicationForm (Application Step Card)", () => {
  it("shows the application number and an accessible progress indicator", () => {
    render(<ApplicationForm application={application} action={noopAction} />);

    expect(screen.getByText(/APP-2026-XYZ789/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Application progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "20");
  });

  it("renders all five prompts with labels and prefills existing answers", () => {
    render(<ApplicationForm application={application} action={noopAction} />);

    expect(
      screen.getByLabelText("Why do you want to join Project Nova?"),
    ).toHaveValue("A steady job that matters.");
    expect(screen.getByLabelText("Work or volunteer experience")).toHaveValue("");
    expect(screen.getByLabelText("Experience with animals")).toBeInTheDocument();
    expect(screen.getByLabelText("When are you available to work?")).toBeInTheDocument();
    expect(
      screen.getByLabelText("How would you get to a shelter site?"),
    ).toBeInTheDocument();
  });

  it("offers an explicit, non-destructive Save Draft action and the concurrency token", () => {
    const { container } = render(
      <ApplicationForm application={application} action={noopAction} />,
    );
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeInTheDocument();
    const token = container.querySelector('input[name="updatedAtToken"]');
    expect(token).toHaveAttribute("value", "2026-07-02T03:04:05.678Z");
  });

  it("renders the Concurrent update state with a reload path", () => {
    render(
      <ApplicationForm
        application={application}
        action={noopAction}
        initialState={{
          status: "conflict",
          formError: "This draft was updated somewhere else.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/changed somewhere else/i);
    expect(screen.getByRole("link", { name: "Reload Latest Draft" })).toHaveAttribute(
      "href",
      "/participant/application",
    );
  });

  it("announces a successful save politely (status, not alert)", () => {
    render(
      <ApplicationForm
        application={application}
        action={noopAction}
        initialState={{ status: "saved", savedAtLabel: "Draft saved" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/draft saved/i);
  });
});
