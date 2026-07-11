import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FundingFormState } from "./actions";
import { FundingSourceForm } from "./funding-source-form";

const noopAction = async (): Promise<FundingFormState> => ({ status: "idle" });

describe("FundingSourceForm", () => {
  it("renders every field with a label above the input", () => {
    render(<FundingSourceForm action={noopAction} submitLabel="Create Funding Source" />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Kind")).toBeInTheDocument();
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Funding Source" }),
    ).toBeInTheDocument();
  });

  it("offers exactly the three approved kinds", () => {
    render(<FundingSourceForm action={noopAction} submitLabel="Create" />);
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent?.trim());
    expect(options).toEqual(["Grant", "Contract", "Other"]);
  });

  it("associates field errors programmatically (aria-describedby + aria-invalid)", () => {
    render(
      <FundingSourceForm
        action={noopAction}
        submitLabel="Create"
        initialState={{
          status: "error",
          fieldErrors: { name: "Enter a name for this funding source." },
        }}
      />,
    );

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", "name-error");
    expect(screen.getByText("Enter a name for this funding source.")).toHaveAttribute(
      "id",
      "name-error",
    );
  });

  it("announces a form-level error as an alert", () => {
    render(
      <FundingSourceForm
        action={noopAction}
        submitLabel="Create"
        initialState={{ status: "error", formError: "You don't have permission to do this." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/don't have permission/i);
  });

  it("pre-fills values in edit mode", () => {
    render(
      <FundingSourceForm
        action={noopAction}
        submitLabel="Save Changes"
        fundingSource={{
          id: "fs_1",
          name: "Workforce Grant",
          kind: "CONTRACT",
          kindLabel: "Contract",
          code: "WF-42",
          status: "ACTIVE",
          statusLabel: "Active",
          startDate: "2026-01-01",
          endDate: null,
          notes: null,
        }}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Workforce Grant");
    expect(screen.getByLabelText("Kind")).toHaveValue("CONTRACT");
    expect(screen.getByLabelText(/code/i)).toHaveValue("WF-42");
    expect(screen.getByLabelText(/start date/i)).toHaveValue("2026-01-01");
  });
});
