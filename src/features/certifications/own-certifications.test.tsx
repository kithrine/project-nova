import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OwnCertificationView } from "@/server/services/certification-service";
import { OwnCertifications } from "./own-certifications";

const certifications: OwnCertificationView[] = [
  {
    id: "cert_1",
    name: "Pet First Aid & CPR",
    issuer: "Animal Care Academy",
    issuedOnLabel: "Jan 5, 2026",
    expiresOnLabel: "Jan 5, 2028",
    expiryState: "ACTIVE",
    expiryLabel: "Active",
    documentId: "doc_1",
  },
  {
    id: "cert_2",
    name: "Food Handler Card",
    issuer: "County Health",
    issuedOnLabel: "Feb 1, 2024",
    expiresOnLabel: "Feb 1, 2026",
    expiryState: "EXPIRED",
    expiryLabel: "Expired",
    documentId: null,
  },
];

describe("OwnCertifications (Story 3.5, AC4)", () => {
  it("renders an accessible list with status as text, never color alone", () => {
    render(<OwnCertifications certifications={certifications} />);

    expect(screen.getByRole("list", { name: "Your certifications" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("explains an expired credential in plain, respectful language", () => {
    render(<OwnCertifications certifications={certifications} />);

    expect(
      screen.getByText(/expired — your coordinator can help you renew it/i),
    ).toBeInTheDocument();
  });

  it("links the supporting document when one exists, named per certification", () => {
    render(<OwnCertifications certifications={certifications} />);

    expect(
      screen.getByRole("link", { name: "View document: Pet First Aid & CPR" }),
    ).toHaveAttribute("href", "/api/documents/doc_1/download");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows no coordinator-only detail (no required-for-matching flag)", () => {
    render(<OwnCertifications certifications={certifications} />);
    expect(screen.queryByText(/required for matching/i)).not.toBeInTheDocument();
  });

  it("renders a calm empty state", () => {
    render(<OwnCertifications certifications={[]} />);
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });
});
