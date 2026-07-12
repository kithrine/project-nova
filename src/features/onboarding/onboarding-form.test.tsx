import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OnboardingFormState } from "./actions";
import { OnboardingForm } from "./onboarding-form";

const noopAction = async (): Promise<OnboardingFormState> => ({ status: "idle" });

describe("OnboardingForm", () => {
  it("renders every field with a label above the input", () => {
    render(<OnboardingForm action={noopAction} />);

    for (const label of [
      "Legal first name",
      "Legal last name",
      "Date of birth",
      "Phone number",
      "Mailing address",
      /apartment, suite, or unit/i,
      "City",
      "State or region",
      "Postal code",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Save and Continue" })).toBeInTheDocument();
  });

  it("associates field errors programmatically (aria-describedby + aria-invalid)", () => {
    render(
      <OnboardingForm
        action={noopAction}
        initialState={{
          status: "error",
          fieldErrors: { dateOfBirth: "The date of birth must be in the past." },
        }}
      />,
    );

    const input = screen.getByLabelText("Date of birth");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "dateOfBirth-error");
    expect(screen.getByText("The date of birth must be in the past.")).toHaveAttribute(
      "id",
      "dateOfBirth-error",
    );
  });

  it("announces a form-level error as an alert", () => {
    render(
      <OnboardingForm
        action={noopAction}
        initialState={{ status: "error", formError: "You need to sign in to continue." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in to continue/i);
  });

  it("uses browser autofill hints for identity and address fields", () => {
    render(<OnboardingForm action={noopAction} />);
    expect(screen.getByLabelText("Legal first name")).toHaveAttribute(
      "autocomplete",
      "given-name",
    );
    expect(screen.getByLabelText("Postal code")).toHaveAttribute(
      "autocomplete",
      "postal-code",
    );
  });
});
