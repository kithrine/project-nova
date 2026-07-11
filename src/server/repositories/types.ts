import type { ActiveStatus, OrganizationKind, Role } from "@/generated/prisma/client";

/**
 * Role-shaped view models (Story 1.4).
 * Repositories return these — never raw Prisma records (RULES.md).
 * Note: no clerkUserId, no timestamps, no fields the UI has no need for.
 */

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  /** Whether a Clerk identity is linked — the raw Clerk ID is never exposed. */
  hasClerkIdentity: boolean;
}

export interface OrganizationView {
  id: string;
  name: string;
  kind: OrganizationKind;
  status: ActiveStatus;
}

export interface MembershipView {
  id: string;
  role: Role;
  roleLabel: string;
  status: ActiveStatus;
  organizationId: string;
  organizationName: string;
  organizationKind: OrganizationKind;
}
