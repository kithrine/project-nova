import { ActiveStatus } from "@/generated/prisma/client";
import type { Membership, Organization } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import { ROLE_LABELS } from "@/server/domain/roles";
import type { MembershipView } from "@/server/repositories/types";

type MembershipWithOrganization = Membership & { organization: Organization };

/** Shape a Prisma Membership (+ organization) into its view model — pure, unit-testable. */
export function toMembershipView(membership: MembershipWithOrganization): MembershipView {
  return {
    id: membership.id,
    role: membership.role,
    roleLabel: ROLE_LABELS[membership.role],
    status: membership.status,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationKind: membership.organization.kind,
  };
}

/**
 * ACTIVE memberships only — the foundation of organization scoping.
 * Deactivated memberships are history: preserved, never granting access.
 */
export async function listActiveMembershipsForUser(userId: string): Promise<MembershipView[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: ActiveStatus.ACTIVE },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map(toMembershipView);
}

/** Archive-not-delete: deactivation preserves the row as history (RULES.md). */
export async function deactivateMembership(membershipId: string): Promise<void> {
  await prisma.membership.update({
    where: { id: membershipId },
    data: { status: ActiveStatus.INACTIVE, deactivatedAt: new Date() },
  });
}
