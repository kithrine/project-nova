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

  it("never grants restricted background permissions through any base role — RRS only (2.7/2.10)", () => {
    for (const role of Object.values(Role)) {
      const expected = role === Role.RESTRICTED_REVIEW_SPECIALIST;
      const granted = permissionsForRoles([role]);
      expect(granted.has("backgroundReview.view"), `view for ${role}`).toBe(expected);
      expect(granted.has("backgroundReview.decide"), `decide for ${role}`).toBe(expected);
    }
  });

  it("keeps the applications workspace to Nova operational roles", () => {
    for (const role of Object.values(Role)) {
      const expected =
        role === Role.PROGRAM_COORDINATOR ||
        role === Role.NOVA_ADMINISTRATOR ||
        role === Role.RESTRICTED_REVIEW_SPECIALIST;
      expect(permissionsForRoles([role]).has("application.view"), `role ${role}`).toBe(
        expected,
      );
    }
  });

  it("keeps decisions and eligibility review to PC and NA — never RRS, shelters, or participants (2.8/2.11)", () => {
    for (const role of Object.values(Role)) {
      const expected = role === Role.PROGRAM_COORDINATOR || role === Role.NOVA_ADMINISTRATOR;
      const granted = permissionsForRoles([role]);
      expect(granted.has("application.accept"), `accept for ${role}`).toBe(expected);
      expect(granted.has("application.reject"), `reject for ${role}`).toBe(expected);
      expect(granted.has("eligibilityReview.decide"), `eligibility for ${role}`).toBe(expected);
      expect(granted.has("interview.schedule"), `schedule for ${role}`).toBe(expected);
      expect(granted.has("interview.record"), `record for ${role}`).toBe(expected);
      // onboardingTask.complete extended to shelter roles for PLACEMENT
      // tasks (Story 5.4) — the service scopes them to their own
      // organization's placements and to shelter-verified tasks only.
      const completeExpected =
        expected || role === Role.SHELTER_SUPERVISOR || role === Role.SHELTER_MANAGER;
      expect(granted.has("onboardingTask.complete"), `task complete for ${role}`).toBe(
        completeExpected,
      );
      expect(granted.has("onboardingTask.reopen"), `task reopen for ${role}`).toBe(expected);
      expect(granted.has("trainingEnrollment.create"), `training create for ${role}`).toBe(
        expected,
      );
      expect(granted.has("trainingEnrollment.update"), `training update for ${role}`).toBe(
        expected,
      );
      expect(granted.has("certification.record"), `certification for ${role}`).toBe(
        expected,
      );
      expect(
        granted.has("enrollment.markReadyForMatching"),
        `mark ready for ${role}`,
      ).toBe(expected);
      expect(granted.has("placementMatch.viewQueue"), `queue for ${role}`).toBe(expected);
      expect(
        granted.has("placementMatch.viewCompatibility"),
        `compatibility for ${role}`,
      ).toBe(expected);
      expect(granted.has("placementMatch.manageDraft"), `draft for ${role}`).toBe(
        expected,
      );
      expect(granted.has("placementMatch.propose"), `propose for ${role}`).toBe(expected);
    }
  });

  it("keeps placement lifecycle transitions to PC and NA — never shelters, GA, or participants (5.6/5.7)", () => {
    for (const role of Object.values(Role)) {
      const expected = role === Role.PROGRAM_COORDINATOR || role === Role.NOVA_ADMINISTRATOR;
      const granted = permissionsForRoles([role]);
      expect(granted.has("placement.activate"), `activate for ${role}`).toBe(expected);
      expect(granted.has("placement.pause"), `pause for ${role}`).toBe(expected);
      expect(granted.has("placement.resume"), `resume for ${role}`).toBe(expected);
    }
  });

  it("never grants shelter roles any application, document, or note permission", () => {
    for (const role of [Role.SHELTER_SUPERVISOR, Role.SHELTER_MANAGER]) {
      const granted = permissionsForRoles([role]);
      expect(granted.has("application.view")).toBe(false);
      expect(granted.has("document.view")).toBe(false);
      expect(granted.has("caseNote.create")).toBe(false);
      expect(granted.has("backgroundReview.view")).toBe(false);
    }
  });
});
