import { describe, expect, it } from "vitest";

import { Role } from "@/generated/prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, permissionsForRoles } from "./permissions";

describe("permission registry", () => {
  it("uses resource.action codes exclusively", () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$/);
    }
  });

  it("maps every role, and only to registered permissions", () => {
    for (const role of Object.values(Role)) {
      const permissions = ROLE_PERMISSIONS[role];
      expect(permissions, `role ${role} has no mapping`).toBeDefined();
      for (const permission of permissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

describe("permissionsForRoles (deny-by-default)", () => {
  it("grants nothing for no roles", () => {
    expect(permissionsForRoles([]).size).toBe(0);
  });

  it("does not grant funding.manage to non-funding roles", () => {
    for (const role of [
      Role.PARTICIPANT,
      Role.SHELTER_SUPERVISOR,
      Role.SHELTER_MANAGER,
      Role.PROGRAM_COORDINATOR,
      Role.RESTRICTED_REVIEW_SPECIALIST,
    ]) {
      expect(permissionsForRoles([role]).has("funding.manage")).toBe(false);
    }
  });

  it("grants funding.manage to Grant Administrator and Nova Administrator", () => {
    expect(permissionsForRoles([Role.GRANT_ADMINISTRATOR]).has("funding.manage")).toBe(true);
    expect(permissionsForRoles([Role.NOVA_ADMINISTRATOR]).has("funding.manage")).toBe(true);
  });

  it("unions permissions across multiple roles", () => {
    const merged = permissionsForRoles([Role.PARTICIPANT, Role.GRANT_ADMINISTRATOR]);
    expect(merged.has("organization.view")).toBe(true);
    expect(merged.has("funding.manage")).toBe(true);
  });
});
