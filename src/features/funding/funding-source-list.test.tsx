import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FundingSourceView } from "@/server/services/funding-source-service";
import { FundingSourceList } from "./funding-source-list";

const sources: FundingSourceView[] = [
  {
    id: "fs_1",
    name: "Second Chance Grant",
    kind: "GRANT",
    kindLabel: "Grant",
    code: "SCG-1",
    status: "ACTIVE",
    statusLabel: "Active",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    notes: null,
  },
  {
    id: "fs_2",
    name: "Legacy Contract",
    kind: "CONTRACT",
    kindLabel: "Contract",
    code: null,
    status: "INACTIVE",
    statusLabel: "Inactive",
    startDate: null,
    endDate: null,
    notes: null,
  },
];

describe("FundingSourceList", () => {
  it("renders each source with its status as text (never color alone)", () => {
    render(<FundingSourceList sources={sources} />);

    expect(screen.getByRole("link", { name: "Second Chance Grant" })).toHaveAttribute(
      "href",
      "/operations/administration/funding-sources/fs_1",
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Grant")).toBeInTheDocument();
  });

  it("renders an accessible table with column headers", () => {
    render(<FundingSourceList sources={sources} />);
    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["Name", "Kind", "Code", "Status", "Dates"]);
  });

  it("shows the empty state when there are no sources", () => {
    render(<FundingSourceList sources={[]} />);
    expect(screen.getByText(/no funding sources yet/i)).toBeInTheDocument();
  });
});
