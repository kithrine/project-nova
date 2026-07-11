import { describe, expect, it } from "vitest";

import { Role } from "@/generated/prisma/client";
import { isNovaRole, isShelterRole, NOVA_ROLES, ROLE_LABELS, SHELTER_ROLES } from "./roles";

describe("ROLE_LABELS", () => {
  it("labels every role in the enum (exhaustive)", () => {
    for (const role of Object.values(Role)) {
      expect(ROLE_LABELS[role], `missing label for ${role}`).toBeTruthy();
    }
  });

  it("uses the exact approved terminology (TERMINOLOGY.md)", () => {
    expect(ROLE_LABELS[Role.PROGRAM_COORDINATOR]).toBe("Program Coordinator");
    expect(ROLE_LABELS[Role.SHELTER_SUPERVISOR]).toBe("Shelter Supervisor");
    expect(ROLE_LABELS[Role.SHELTER_MANAGER]).toBe("Shelter Manager");
  });
});

describe("role partitions", () => {
  it("classifies Nova staff roles", () => {
    for (const role of NOVA_ROLES) {
      expect(isNovaRole(role)).toBe(true);
      expect(isShelterRole(role)).toBe(false);
    }
  });

  it("classifies shelter roles", () => {
    for (const role of SHELTER_ROLES) {
      expect(isShelterRole(role)).toBe(true);
      expect(isNovaRole(role)).toBe(false);
    }
  });

  it("treats Participant as neither Nova staff nor shelter staff", () => {
    expect(isNovaRole(Role.PARTICIPANT)).toBe(false);
    expect(isShelterRole(Role.PARTICIPANT)).toBe(false);
  });

  it("every role is participant, Nova, or shelter — no unclassified role", () => {
    for (const role of Object.values(Role)) {
      const classified =
        role === Role.PARTICIPANT || isNovaRole(role) || isShelterRole(role);
      expect(classified, `${role} is unclassified`).toBe(true);
    }
  });
});
