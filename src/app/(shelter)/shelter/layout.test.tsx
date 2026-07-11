import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveStatus, OrganizationKind, Role } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/context", () => ({ getAuthContext }));
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import OperationsLayout from "../../(operations)/operations/layout";
import ShelterLayout from "./layout";

function ctxWith(role: Role): AuthContext {
  return {
    userId: "user_1",
    email: "user@synthetic.example",
    displayName: "Casey Test",
    memberships: [
      {
        id: "m1",
        role,
        roleLabel: role,
        status: ActiveStatus.ACTIVE,
        organizationId: "org_1",
        organizationName: "Org",
        organizationKind: OrganizationKind.HOST,
      },
    ],
  };
}

describe("protected layouts (Story 1.7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shelter layout renders the shell for an active shelter membership", async () => {
    getAuthContext.mockResolvedValue(ctxWith(Role.SHELTER_SUPERVISOR));
    render(await ShelterLayout({ children: <p>shelter content</p> }));

    expect(screen.getByText("shelter content")).toBeInTheDocument();
    expect(
      screen.getAllByRole("navigation", { name: "Shelter navigation" }).length,
    ).toBeGreaterThan(0);
  });

  it("shelter layout shows Permission denied for a non-shelter user", async () => {
    getAuthContext.mockResolvedValue(ctxWith(Role.PARTICIPANT));
    render(await ShelterLayout({ children: <p>shelter content</p> }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("shelter content")).toBeNull();
  });

  it("operations layout renders the shell for Nova staff", async () => {
    getAuthContext.mockResolvedValue(ctxWith(Role.PROGRAM_COORDINATOR));
    render(await OperationsLayout({ children: <p>ops content</p> }));

    expect(screen.getByText("ops content")).toBeInTheDocument();
  });

  it("operations layout shows Permission denied for a shelter user (cross-experience)", async () => {
    getAuthContext.mockResolvedValue(ctxWith(Role.SHELTER_SUPERVISOR));
    render(await OperationsLayout({ children: <p>ops content</p> }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("ops content")).toBeNull();
  });

  it("operations layout shows Permission denied when unauthenticated context is missing", async () => {
    getAuthContext.mockResolvedValue(null);
    render(await OperationsLayout({ children: <p>ops content</p> }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
