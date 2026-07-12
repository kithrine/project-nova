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
  // Operations applications queue + workspace (Story 2.7). Applicants view
  // their OWN application via ownership (2.3/2.6), never this permission.
  "application.view",
  // Restricted background-review content (Story 2.7): NOT implied by any
  // base role — "a coordinator may not view detailed background data
  // without explicit restricted permission" (authorization-rbac.md). Every
  // authorized read is written to an AuditEvent.
  "backgroundReview.view",
  // Internal case notes on an application (Story 2.7): Nova Operations only.
  "caseNote.create",
  // Terminal decisions (Story 2.11): accept additionally requires the
  // business prerequisite of a recorded Clear background outcome (2.10);
  // reject/disqualify follow ADR-016. Never shelters, never applicants.
  "application.accept",
  "application.reject",
  // Eligibility review (Story 2.8, ADR-015): standard Coordinator tier —
  // eligibility is NOT restricted the way background review is.
  "eligibilityReview.decide",
  // Interview workflow (Story 2.9): standard Coordinator tier.
  "interview.schedule",
  "interview.record",
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
  [Role.PROGRAM_COORDINATOR]: [
    "organization.view",
    "document.view",
    "application.view",
    "caseNote.create",
    "application.accept",
    "application.reject",
    "eligibilityReview.decide",
    "interview.schedule",
    "interview.record",
  ],
  [Role.GRANT_ADMINISTRATOR]: ["organization.view", "funding.manage"],
  [Role.NOVA_ADMINISTRATOR]: [
    "organization.view",
    "funding.manage",
    "document.view",
    "application.view",
    "caseNote.create",
    "application.accept",
    "application.reject",
    "eligibilityReview.decide",
    "interview.schedule",
    "interview.record",
  ],
  // The optional restricted role (authorization-rbac.md): the ONLY role
  // that carries backgroundReview.view by default.
  [Role.RESTRICTED_REVIEW_SPECIALIST]: [
    "organization.view",
    "document.view",
    "application.view",
    "backgroundReview.view",
  ],
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
