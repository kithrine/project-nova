import { describe, expect, it } from "vitest";

import { ActiveStatus, OrganizationKind, Role } from "@/generated/prisma/client";
import type { Membership, Organization, User } from "@/generated/prisma/client";
import { toMembershipView } from "./membership-repository";
import { toUserView } from "./user-repository";

/**
 * View-model shaping (Story 1.4): repositories return role-shaped view
 * models, never raw Prisma records (RULES.md). These are pure functions,
 * tested without a database.
 */

const now = new Date();

const user: User = {
  id: "user_1",
  clerkUserId: "clerk_abc123",
  email: "coordinator@synthetic.example",
  displayName: "Synthetic Program Coordinator",
  isSynthetic: true,
  createdAt: now,
  updatedAt: now,
};

const organization: Organization = {
  id: "org_1",
  name: "Sunny Paws Animal Shelter (Synthetic)",
  kind: OrganizationKind.HOST,
  status: ActiveStatus.ACTIVE,
  isSynthetic: true,
  createdAt: now,
  updatedAt: now,
};

const membership: Membership & { organization: Organization } = {
  id: "membership_1",
  userId: user.id,
  organizationId: organization.id,
  role: Role.SHELTER_SUPERVISOR,
  status: ActiveStatus.ACTIVE,
  deactivatedAt: null,
  createdAt: now,
  updatedAt: now,
  organization,
};

describe("toUserView", () => {
  it("shapes the user without exposing the raw Clerk identifier", () => {
    const view = toUserView(user);
    expect(view).toEqual({
      id: "user_1",
      email: "coordinator@synthetic.example",
      displayName: "Synthetic Program Coordinator",
      hasClerkIdentity: true,
    });
    expect(JSON.stringify(view)).not.toContain("clerk_abc123");
  });

  it("reports a missing Clerk identity as a boolean", () => {
    expect(toUserView({ ...user, clerkUserId: null }).hasClerkIdentity).toBe(false);
  });
});

describe("toMembershipView", () => {
  it("shapes the membership with its organization context and plain-language label", () => {
    const view = toMembershipView(membership);
    expect(view).toEqual({
      id: "membership_1",
      role: Role.SHELTER_SUPERVISOR,
      roleLabel: "Shelter Supervisor",
      status: ActiveStatus.ACTIVE,
      organizationId: "org_1",
      organizationName: "Sunny Paws Animal Shelter (Synthetic)",
      organizationKind: OrganizationKind.HOST,
    });
  });

  it("does not pass through raw record fields like timestamps or userId", () => {
    const view = toMembershipView(membership) as unknown as Record<string, unknown>;
    expect(view.userId).toBeUndefined();
    expect(view.createdAt).toBeUndefined();
    expect(view.deactivatedAt).toBeUndefined();
  });
});
