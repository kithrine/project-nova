import { describe, expect, it } from "vitest";

import { ActiveStatus, OrganizationKind, Role } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import type { MembershipView } from "@/server/repositories/types";
import { canAccessExperience, routeForContext } from "./experience";

function membership(role: Role): MembershipView {
  return {
    id: `m_${role}`,
    role,
    roleLabel: role,
    status: ActiveStatus.ACTIVE,
    organizationId: "org_1",
    organizationName: "Org",
    organizationKind: OrganizationKind.HOST,
  };
}

function ctxWith(...roles: Role[]): AuthContext {
  return {
    userId: "user_1",
    email: "user@synthetic.example",
    displayName: "Test User",
    memberships: roles.map(membership),
  };
}

describe("canAccessExperience", () => {
  it("gates operations to Nova-staff roles only", () => {
    expect(canAccessExperience(ctxWith(Role.PROGRAM_COORDINATOR), "operations")).toBe(true);
    expect(canAccessExperience(ctxWith(Role.NOVA_ADMINISTRATOR), "operations")).toBe(true);
    expect(canAccessExperience(ctxWith(Role.SHELTER_SUPERVISOR), "operations")).toBe(false);
    expect(canAccessExperience(ctxWith(Role.PARTICIPANT), "operations")).toBe(false);
    expect(canAccessExperience(ctxWith(), "operations")).toBe(false);
  });

  it("gates shelter to shelter roles only", () => {
    expect(canAccessExperience(ctxWith(Role.SHELTER_SUPERVISOR), "shelter")).toBe(true);
    expect(canAccessExperience(ctxWith(Role.SHELTER_MANAGER), "shelter")).toBe(true);
    expect(canAccessExperience(ctxWith(Role.PROGRAM_COORDINATOR), "shelter")).toBe(false);
    expect(canAccessExperience(ctxWith(Role.PARTICIPANT), "shelter")).toBe(false);
  });

  it("allows any provisioned account into the participant experience (until Epic 2/3 tightens it)", () => {
    expect(canAccessExperience(ctxWith(Role.PARTICIPANT), "participant")).toBe(true);
    expect(canAccessExperience(ctxWith(), "participant")).toBe(true);
  });
});

describe("routeForContext", () => {
  it("routes staff to operations first, then shelter, then participant", () => {
    expect(routeForContext(ctxWith(Role.PROGRAM_COORDINATOR))).toBe("/operations");
    expect(routeForContext(ctxWith(Role.SHELTER_SUPERVISOR))).toBe("/shelter");
    expect(routeForContext(ctxWith(Role.PARTICIPANT))).toBe("/participant");
    expect(routeForContext(ctxWith())).toBe("/participant");
  });

  it("prefers operations for users holding multiple membership types", () => {
    expect(routeForContext(ctxWith(Role.SHELTER_MANAGER, Role.NOVA_ADMINISTRATOR))).toBe(
      "/operations",
    );
  });
});
