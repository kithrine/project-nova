import { Role } from "@/generated/prisma/client";

/**
 * Permission registry (Story 1.5). Codes are `resource.action`
 * (docs/architecture/coding-standards.md). Definitions and role mappings
 * live in TypeScript for MVP (docs/architecture/authorization-rbac.md).
 *
 * This registry GROWS WITH EACH EPIC — a permission is added in the story
 * that introduces its capability (e.g. application.review with Epic 2,
 * timesheet.approve with Epic 6). Holding a permission alone never
 * authorizes anything: every operation also checks resource scope and
 * lifecycle state (Authorization = Permission + Resource Scope +
 * Lifecycle State).
 */
export const PERMISSIONS = [
  // Every signed-in member may view basic info for organizations in their scope.
  "organization.view",
  // Funding-source reference data (Story 1.8).
  "funding.manage",
  // Application documents (Story 2.4): Operations reviewers only — shelters
  // are never granted this (business-rules.md Privacy). Applicant owners
  // access their own documents via ownership, not this permission.
  "document.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission mapping. Deny-by-default: anything not listed here
 * is denied. Never derived from client input or Clerk claims (ADR-004).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.PARTICIPANT]: ["organization.view"],
  [Role.SHELTER_SUPERVISOR]: ["organization.view"],
  [Role.SHELTER_MANAGER]: ["organization.view"],
  [Role.PROGRAM_COORDINATOR]: ["organization.view", "document.view"],
  [Role.GRANT_ADMINISTRATOR]: ["organization.view", "funding.manage"],
  [Role.NOVA_ADMINISTRATOR]: ["organization.view", "funding.manage", "document.view"],
  [Role.RESTRICTED_REVIEW_SPECIALIST]: ["organization.view", "document.view"],
};

export function permissionsForRoles(roles: readonly Role[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      result.add(permission);
    }
  }
  return result;
}
