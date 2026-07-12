import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DecisionFormState } from "./actions";
import { DecisionPanel } from "./decision-panel";

const noopAction = async (): Promise<DecisionFormState> => ({ status: "idle" });

function renderPanel(overrides: Partial<Parameters<typeof DecisionPanel>[0]> = {}) {
  return render(
    <DecisionPanel
      canAccept={true}
      canReject={true}
      acceptDisabledReason={null}
      acceptAction={noopAction}
      rejectAction={noopAction}
      {...overrides}
    />,
  );
}

describe("DecisionPanel (Story 2.11)", () => {
  it("keeps Accept disabled with the stated reason while the prerequisite is unmet", () => {
    renderPanel({
      acceptDisabledReason:
        "a recorded Clear background outcome is required before acceptance (arrives with Story 2.10)",
    });

    const accept = screen.getByRole("button", { name: "Accept Application" });
    expect(accept).toBeDisabled();
    expect(accept).toHaveAttribute("aria-describedby", "accept-blocked-reason");
    expect(screen.getByText(/Clear background outcome/i)).toBeInTheDocument();
  });

  it("opens the rejection panel with both category groups and the ADR-016 warning", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Reject Application…" }));

    expect(screen.getAllByRole("radio")).toHaveLength(7); // 4 ordinary + 3 disqualifying
    expect(
      screen.getByText(/Permanent disqualification \(ADR-016\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/blocks all future\s+applications/i)).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /animal-possession ban/i }),
    ).toBeInTheDocument();
  });

  it("requires BOTH a category and the explicit confirmation before recording", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Reject Application…" }));

    const record = screen.getByRole("button", { name: "Record Decision" });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Other program reason/ }));
    expect(record).toBeDisabled(); // category alone is not enough

    fireEvent.click(screen.getByRole("checkbox", { name: /this decision is final/i }));
    expect(record).toBeEnabled();
  });

  it("cancel closes the panel and resets the confirmation", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Reject Application…" }));
    fireEvent.click(screen.getByRole("radio", { name: /Other program reason/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /this decision is final/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    // Reopening starts clean — no lingering selection or confirmation.
    fireEvent.click(screen.getByRole("button", { name: "Reject Application…" }));
    expect(screen.getByRole("button", { name: "Record Decision" })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /this decision is final/i }),
    ).not.toBeChecked();
  });

  it("announces a recorded decision as a status with respectful framing", () => {
    renderPanel({ initialRejectState: { status: "decided" } });

    expect(screen.getByRole("status")).toHaveTextContent(/Decision recorded/);
    expect(screen.getByRole("status")).toHaveTextContent(/approved, respectful/i);
    expect(
      screen.queryByRole("button", { name: "Reject Application…" }),
    ).not.toBeInTheDocument();
  });

  it("names the enrollment and onboarding next step after an acceptance (Story 3.1)", () => {
    renderPanel({ initialAcceptState: { status: "decided" } });

    expect(screen.getByRole("status")).toHaveTextContent(
      /enrollment were created together. Next step: onboarding/,
    );
  });

  it("renders nothing for viewers without either decision permission", () => {
    const { container } = renderPanel({ canAccept: false, canReject: false });
    expect(container).toBeEmptyDOMElement();
  });
});
