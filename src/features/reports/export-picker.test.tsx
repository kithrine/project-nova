import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EXPORT_DEFINITIONS } from "@/server/services/export-service";

import { ExportPicker } from "./export-picker";

describe("ExportPicker", () => {
  it("lists all four named exports", () => {
    render(<ExportPicker definitions={EXPORT_DEFINITIONS} />);
    const list = screen.getByRole("list", { name: "Named exports" });
    for (const name of [
      "Active placement summary",
      "Approved hours by funding source",
      "Shelter roster",
      "Outcome summary",
    ]) {
      expect(within(list).getByText(name)).toBeInTheDocument();
    }
  });

  it("confirms with the complete field allow-list and the audit notice before the download control", () => {
    render(<ExportPicker definitions={EXPORT_DEFINITIONS} />);

    const hours = screen
      .getByText("Approved hours by funding source")
      .closest("li") as HTMLElement;
    expect(
      within(hours).getByText("This export contains exactly these fields:"),
    ).toBeInTheDocument();
    expect(within(hours).getByText("Finalized hours")).toBeInTheDocument();
    expect(within(hours).getByText("Award code")).toBeInTheDocument();
    expect(within(hours).getByText(/records an audit event/)).toBeInTheDocument();
    expect(within(hours).getByText(/nothing is stored/)).toBeInTheDocument();

    const link = within(hours).getByRole("link", {
      name: "Download Approved hours by funding source",
    });
    expect(link).toHaveAttribute("href", "/api/exports/hours-by-funding");
    expect(link).toHaveAttribute("download");
  });

  it("carries the ADR-020 provisional note on the hours export only", () => {
    render(<ExportPicker definitions={EXPORT_DEFINITIONS} />);
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent(/provisional pilot format/i);
  });

  it("never renders a restricted-field column in any definition", () => {
    render(<ExportPicker definitions={EXPORT_DEFINITIONS} />);
    const text = screen.getByRole("list", { name: "Named exports" }).textContent ?? "";
    expect(text).not.toMatch(/background|case note|narrative|government|ssn/i);
  });
});
