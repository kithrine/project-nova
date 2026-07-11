import { describe, expect, it, vi } from "vitest";

import { ActiveStatus, OrganizationKind, Role } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import {
  AuthorizationError,
  LifecycleError,
  NotFoundError,
} from "@/server/errors/app-error";
import type { MembershipView } from "@/server/repositories/types";
import {
  authorizeOperation,
  hasNovaScope,
  hasPermission,
  requireLifecycleState,
  requireOrganizationScope,
  requirePermission,
  requirePrerequisites,
} from "./authorize";

function membership(role: Role, organizationId: string): MembershipView {
  return {
    id: `m_${role}_${organizationId}`,
    role,
    roleLabel: role,
    status: ActiveStatus.ACTIVE,
    organizationId,
    organizationName: `Org ${organizationId}`,
    organizationKind: role === Role.PARTICIPANT ? OrganizationKind.NOVA : OrganizationKind.HOST,
  };
}

function ctxWith(...memberships: MembershipView[]): AuthContext {
  return {
    userId: "user_1",
    email: "user@synthetic.example",
    displayName: "Test User",
    memberships,
  };
}

const shelterCtx = ctxWith(membership(Role.SHELTER_SUPERVISOR, "org_a"));
const novaCtx = ctxWith(membership(Role.PROGRAM_COORDINATOR, "org_nova"));
const grantAdminCtx = ctxWith(membership(Role.GRANT_ADMINISTRATOR, "org_nova"));
const emptyCtx = ctxWith();

describe("permission checks (step 4)", () => {
  it("derives permissions solely from active memberships", () => {
    expect(hasPermission(shelterCtx, "organization.view")).toBe(true);
    expect(hasPermission(shelterCtx, "funding.manage")).toBe(false);
    expect(hasPermission(grantAdminCtx, "funding.manage")).toBe(true);
  });

  it("denies everything for a user with no memberships (deny-by-default)", () => {
    expect(hasPermission(emptyCtx, "organization.view")).toBe(false);
    expect(() => requirePermission(emptyCtx, "organization.view")).toThrow(
      AuthorizationError,
    );
  });

  it("ignores client-style claims smuggled onto the context object", () => {
    // Even if a forged property claims admin rights, authorization only
    // reads the memberships array (server-resolved).
    const forged = {
      ...emptyCtx,
      role: "NOVA_ADMINISTRATOR",
      permissions: ["funding.manage"],
    } as unknown as AuthContext;
    expect(hasPermission(forged, "funding.manage")).toBe(false);
  });
});

describe("scope checks (step 6)", () => {
  it("passes for a membership in the resource's organization", () => {
    expect(requireOrganizationScope(shelterCtx, "org_a").organizationId).toBe("org_a");
  });

  it("denies cross-organization access for shelter roles", () => {
    expect(() => requireOrganizationScope(shelterCtx, "org_b")).toThrow(AuthorizationError);
  });

  it("grants Nova staff Nova-wide scope", () => {
    expect(hasNovaScope(novaCtx)).toBe(true);
    expect(requireOrganizationScope(novaCtx, "org_b").role).toBe(Role.PROGRAM_COORDINATOR);
  });

  it("shelter roles never get Nova-wide scope", () => {
    expect(hasNovaScope(shelterCtx)).toBe(false);
  });
});

describe("lifecycle and prerequisites (steps 7–8)", () => {
  it("gates on lifecycle state", () => {
    expect(() => requireLifecycleState("INACTIVE", ["ACTIVE"])).toThrow(LifecycleError);
    expect(() => requireLifecycleState("ACTIVE", ["ACTIVE"])).not.toThrow();
  });

  it("requires every prerequisite to be satisfied", () => {
    expect(() => requirePrerequisites(["training incomplete"])).toThrow(LifecycleError);
    expect(() => requirePrerequisites([])).not.toThrow();
  });
});

describe("authorizeOperation (steps 4–8 in order)", () => {
  const resource = { id: "org_a", status: "ACTIVE" };

  it("checks permission BEFORE loading the resource", async () => {
    const loadResource = vi.fn();
    await expect(
      authorizeOperation({
        ctx: emptyCtx,
        permission: "organization.view",
        loadResource,
        resourceOrganizationId: () => "org_a",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(loadResource).not.toHaveBeenCalled();
  });

  it("throws NotFound for a missing resource", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => null,
        resourceOrganizationId: () => "org_a",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies out-of-scope resources even with the permission", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => ({ ...resource, id: "org_b" }),
        resourceOrganizationId: (r) => r.id,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("denies disallowed lifecycle states even with permission and scope", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => ({ ...resource, status: "INACTIVE" }),
        resourceOrganizationId: (r) => r.id,
        lifecycle: (r) => ({ current: r.status, allowed: ["ACTIVE"] }),
      }),
    ).rejects.toBeInstanceOf(LifecycleError);
  });

  it("denies when business prerequisites fail", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => resource,
        resourceOrganizationId: (r) => r.id,
        prerequisites: () => ["schedule not confirmed"],
      }),
    ).rejects.toBeInstanceOf(LifecycleError);
  });

  it("requires Nova scope for Nova-global resources", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => resource,
        resourceOrganizationId: () => null,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await expect(
      authorizeOperation({
        ctx: novaCtx,
        permission: "organization.view",
        loadResource: async () => resource,
        resourceOrganizationId: () => null,
      }),
    ).resolves.toBe(resource);
  });

  it("returns the resource when every step passes", async () => {
    await expect(
      authorizeOperation({
        ctx: shelterCtx,
        permission: "organization.view",
        loadResource: async () => resource,
        resourceOrganizationId: (r) => r.id,
        lifecycle: (r) => ({ current: r.status, allowed: ["ACTIVE"] }),
        prerequisites: () => [],
      }),
    ).resolves.toBe(resource);
  });
});
