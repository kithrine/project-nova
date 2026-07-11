import { Role } from "@/generated/prisma/client";

/**
 * Role helpers (Story 1.4). Roles are data, not authorization — every
 * protected operation is evaluated as Permission + Resource Scope +
 * Lifecycle State (docs/architecture/authorization-rbac.md, Story 1.5).
 */

/** Plain-language labels for display (docs/ux/content-style-guide.md). */
export const ROLE_LABELS: Record<Role, string> = {
  [Role.PARTICIPANT]: "Participant",
  [Role.SHELTER_SUPERVISOR]: "Shelter Supervisor",
  [Role.SHELTER_MANAGER]: "Shelter Manager",
  [Role.PROGRAM_COORDINATOR]: "Program Coordinator",
  [Role.GRANT_ADMINISTRATOR]: "Grant Administrator",
  [Role.NOVA_ADMINISTRATOR]: "Nova Administrator",
  [Role.RESTRICTED_REVIEW_SPECIALIST]: "Restricted Review Specialist",
};

/** Roles held by Nova staff (memberships in the Nova organization). */
export const NOVA_ROLES = [
  Role.PROGRAM_COORDINATOR,
  Role.GRANT_ADMINISTRATOR,
  Role.NOVA_ADMINISTRATOR,
  Role.RESTRICTED_REVIEW_SPECIALIST,
] as const;

/** Roles held at a host organization (shelter partner workspace). */
export const SHELTER_ROLES = [Role.SHELTER_SUPERVISOR, Role.SHELTER_MANAGER] as const;

export function isNovaRole(role: Role): boolean {
  return (NOVA_ROLES as readonly Role[]).includes(role);
}

export function isShelterRole(role: Role): boolean {
  return (SHELTER_ROLES as readonly Role[]).includes(role);
}
