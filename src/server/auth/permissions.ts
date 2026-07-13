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
  // Story 5.9 reuses the same permission for placement notes — one
  // authoring capability, XOR-owned contexts.
  "caseNote.create",
  // Reading placement case notes (Story 5.9): gates the Case Notes tab's
  // presence in the Nova workspace view. Application-note reads remain
  // application.view-gated as shipped in 2.7. Never shelter, participant,
  // or Grant Administrator roles — the tab is structurally absent.
  "caseNote.view",
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
  // Recording a background decision (Story 2.10): restricted, like
  // backgroundReview.view — never implied by any base role except RRS.
  "backgroundReview.decide",
  // Onboarding task list on an enrollment (Story 3.2): Nova Operations
  // only; shelters have no access to enrollment-stage onboarding data.
  "onboardingTask.view",
  // Task completion and correction (Story 3.3): the staff paths. A
  // participant completes their OWN participant-completable tasks via
  // ownership (like the applicant tier), never via these grants. Story
  // 5.4 extends complete to shelter roles for PLACEMENT tasks only — the
  // service scopes shelter holders to their organization's placements
  // and to shelter-verified (non-participant) tasks.
  "onboardingTask.complete",
  "onboardingTask.reopen",
  // Portable training attempts (Story 3.4; ADR-017): coordinator-only
  // writes in Nova scope. Participants see only the rolled-up journey step.
  "trainingEnrollment.create",
  "trainingEnrollment.update",
  // Certifications (Story 3.5; ADR-017): coordinator-recorded credentials.
  // Participants read their OWN certifications via ownership, never this.
  "certification.record",
  // The gated Training -> Ready for Matching transition (Story 3.7):
  // re-evaluates the 3.6 blocker policy inside the transaction.
  "enrollment.markReadyForMatching",
  // The Epic 4 matching queue (Story 4.1): spans ALL shelters, so it is
  // Nova-scoped and never granted to shelter or participant roles.
  "placementMatch.viewQueue",
  // The categorical compatibility read (Story 4.2): coordinator decision
  // support only — never a shelter- or participant-facing artifact
  // (docs/product/compatibility-engine.md).
  "placementMatch.viewCompatibility",
  // Draft matches (Story 4.3): create, edit, and withdraw while DRAFT.
  // Drafts are coordinator-internal — never participant- or shelter-visible.
  "placementMatch.manageDraft",
  // Draft -> Proposed (Story 4.4): the moment match details first cross
  // the organization boundary to the participant and the shelter.
  "placementMatch.propose",
  // Coordinator-ASSISTED recording of the participant's decision (Story
  // 4.5) when it was communicated by phone or in person. The participant
  // decides their OWN match via ownership (Person -> Participant), never
  // via a role grant — this permission is only the staff recording path.
  "placementMatch.recordParticipantDecision",
  // Shelter-side visibility of matches at PROPOSED or later (Story 4.6),
  // always additionally scoped to the member's own organization via
  // hostOrganizationId — Draft is never visible regardless of scope.
  "placementMatch.view",
  // The shelter's decision track (Story 4.6): Shelter MANAGER only —
  // "the partner representative approving placements" (TERMINOLOGY.md).
  // Supervisors view; they never decide.
  "placementMatch.recordShelterDecision",
  // Resolving a Change Requested match (Story 4.7): edit the terms and
  // re-propose (both decision tracks reset), or withdraw. Coordinator-only
  // in MVP — never participant- or shelter-initiated.
  "placementMatch.revise",
  // The epic's human-in-the-loop gate (Story 4.8; ADR-011): final match
  // approval, taken together with placement.create in ONE transaction —
  // the system surfaces eligibility but never approves on its own.
  "placementMatch.approve",
  "placement.create",
  // The placement workspace (Story 5.1): Nova-wide for Operations roles;
  // organization scope via hostOrganizationId for shelter roles. The
  // participant reads their OWN placement via ownership, never a grant.
  // Tab and field visibility are shaped server-side per role — a hidden
  // tab is never the only protection.
  "placement.view",
  // Site/supervisor/schedule assignment and the propose action (Story
  // 5.2): coordinator-side package building, Nova scope.
  "placement.assign",
  // The placement-level shelter gate (Story 5.2; ADR-013): the Shelter
  // MANAGER approves the specific site/supervisor/schedule package or
  // returns it — org-scoped, SHELTER_REVIEW-gated. Distinct from the
  // match-level shelter decision in Epic 4.
  "placement.approve",
  // Funding assignments on a placement (Story 5.3; ADR-010): Grant
  // Administrator primary, coordinator-tier per the role mapping. Exactly
  // one ACTIVE assignment per placement; shelters never assign funding.
  "funding.assign",
  // The activation gate (Story 5.6): Onboarding -> Active after full
  // in-transaction re-validation of every activation prerequisite.
  // Lifecycle transitions are Nova Operations only (mvp.md) — never
  // shelter or participant roles.
  "placement.activate",
  // The Active <-> Paused loop (Story 5.7): pause with a reason and
  // effective date, resume with a resume date — every cycle historized.
  // Nova Operations only, like every lifecycle transition; shelters
  // document circumstances through case notes or incidents instead.
  "placement.pause",
  "placement.resume",
  // Workplace evaluations (Story 5.10; mvp.md Shelter Portal): shelter
  // staff submit, additionally scoped to their own organization's
  // placements and to Active/Paused stages by the service.
  "evaluation.create",
  // Nova Operations reads all evaluations in scope (Story 5.10).
  // Participant visibility is an OPEN policy question
  // (open-questions.md #5) and defaults closed — no participant grant,
  // no participant query path.
  "evaluation.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission mapping. Deny-by-default: anything not listed here
 * is denied. Never derived from client input or Clerk claims (ADR-004).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.PARTICIPANT]: ["organization.view"],
  [Role.SHELTER_SUPERVISOR]: [
    "organization.view",
    "placementMatch.view",
    "placement.view",
    "onboardingTask.complete",
    "evaluation.create",
  ],
  [Role.SHELTER_MANAGER]: [
    "organization.view",
    "placementMatch.view",
    "placementMatch.recordShelterDecision",
    "placement.view",
    "placement.approve",
    "onboardingTask.complete",
    "evaluation.create",
  ],
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
    "onboardingTask.view",
    "onboardingTask.complete",
    "onboardingTask.reopen",
    "trainingEnrollment.create",
    "trainingEnrollment.update",
    "certification.record",
    "enrollment.markReadyForMatching",
    "placementMatch.viewQueue",
    "placementMatch.viewCompatibility",
    "placementMatch.manageDraft",
    "placementMatch.propose",
    "placementMatch.recordParticipantDecision",
    "placementMatch.revise",
    "placementMatch.approve",
    "placement.create",
    "placement.view",
    "placement.assign",
    "funding.assign",
    "placement.activate",
    "placement.pause",
    "placement.resume",
    "caseNote.view",
    "evaluation.view",
  ],
  [Role.GRANT_ADMINISTRATOR]: [
    "organization.view",
    "funding.manage",
    "placement.view",
    "funding.assign",
  ],
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
    "onboardingTask.view",
    "onboardingTask.complete",
    "onboardingTask.reopen",
    "trainingEnrollment.create",
    "trainingEnrollment.update",
    "certification.record",
    "enrollment.markReadyForMatching",
    "placementMatch.viewQueue",
    "placementMatch.viewCompatibility",
    "placementMatch.manageDraft",
    "placementMatch.propose",
    "placementMatch.recordParticipantDecision",
    "placementMatch.revise",
    "placementMatch.approve",
    "placement.create",
    "placement.view",
    "placement.assign",
    "funding.assign",
    "placement.activate",
    "placement.pause",
    "placement.resume",
    "caseNote.view",
    "evaluation.view",
  ],
  // The optional restricted role (authorization-rbac.md): the ONLY role
  // that carries backgroundReview.view by default.
  [Role.RESTRICTED_REVIEW_SPECIALIST]: [
    "organization.view",
    "document.view",
    "application.view",
    "backgroundReview.view",
    "backgroundReview.decide",
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
