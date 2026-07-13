import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Placement workspace role shaping against Neon (Story 5.1): the same
 * placement produces a full Nova view, a shelter view with Case Notes
 * structurally absent, and a plain-language participant view; scope
 * violations are denied with no placement data.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("plw51");

describe.skipIf(!hasDatabase)("placement workspace (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let otherManagerId: string;
  let ownerUserId: string;
  let otherParticipantUserId: string;
  let placementId: string;
  let terminalPlacementId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/placement-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const host = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Host Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Main Site"),
              city: "Springfield",
              region: "WA",
              capacity: 2,
            },
          ],
        },
      },
      include: { sites: true },
    });
    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });

    const coordinator = await prisma.user.create({
      data: {
        email: `${runId}-pc@synthetic.example`,
        displayName: testScopedName(runId, "Coordinator"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
        },
      },
    });
    coordinatorId = coordinator.id;
    const manager = await prisma.user.create({
      data: {
        email: `${runId}-mgr@synthetic.example`,
        displayName: testScopedName(runId, "Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    managerId = manager.id;
    const otherManager = await prisma.user.create({
      data: {
        email: `${runId}-mgr2@synthetic.example`,
        displayName: testScopedName(runId, "Other Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: otherOrg.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    otherManagerId = otherManager.id;

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function createParticipantWithEnrollment(tag: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Place",
              legalLastName: testScopedName(runId, tag),
              dateOfBirth: new Date("1991-01-01T00:00:00Z"),
            },
          },
        },
      });
      const person = await prisma.person.findUniqueOrThrow({
        where: { userId: user.id },
      });
      const application = await prisma.application.create({
        data: {
          personId: person.id,
          applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
          status: enums.ApplicationStatus.ACCEPTED,
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
      });
      const participant = await prisma.participant.create({
        data: { personId: person.id },
      });
      const enrollment = await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId: program.id,
          applicationId: application.id,
          status: enums.EnrollmentStatus.READY_FOR_MATCHING,
        },
      });
      return { userId: user.id, participantId: participant.id, enrollmentId: enrollment.id };
    }

    const owner = await createParticipantWithEnrollment("owner");
    ownerUserId = owner.userId;
    const other = await createParticipantWithEnrollment("other");
    otherParticipantUserId = other.userId;

    async function createPlacement(
      tag: string,
      participant: { participantId: string; enrollmentId: string },
      status: "ONBOARDING" | "WITHDRAWN",
    ) {
      const sourceMatch = await prisma.placementMatch.create({
        data: {
          participantId: participant.participantId,
          programEnrollmentId: participant.enrollmentId,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          status: enums.MatchStatus.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.participantId,
          programEnrollmentId: participant.enrollmentId,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus[status],
          supervisorId: managerId,
          schedule: "Mon/Wed mornings",
          startDate: new Date("2026-08-03T00:00:00Z"),
        },
      });
      await prisma.placementEvent.create({
        data: {
          placementId: placement.id,
          fromStatus: null,
          toStatus: enums.PlacementStatus.DRAFT,
          actorUserId: coordinatorId,
        },
      });
      if (status === "WITHDRAWN") {
        await prisma.placementEvent.create({
          data: {
            placementId: placement.id,
            fromStatus: enums.PlacementStatus.SHELTER_REVIEW,
            toStatus: enums.PlacementStatus.WITHDRAWN,
            actorUserId: coordinatorId,
          },
        });
      }
      return placement.id;
    }

    placementId = await createPlacement("main", owner, "ONBOARDING");
    terminalPlacementId = await createPlacement("done", other, "WITHDRAWN");
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placementEvent.deleteMany({
      where: { placement: { participant: { person: { user: { email: emails } } } } },
    });
    await prisma.placement.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementMatchEvent.deleteMany({
      where: {
        placementMatch: { participant: { person: { user: { email: emails } } } },
      },
    });
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.participant.deleteMany({
      where: { person: { user: { email: emails } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email: emails } } },
    });
    await prisma.person.deleteMany({ where: { user: { email: emails } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("gives Nova Operations the full nine-tab workspace (AC1)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getPlacementWorkspace(ctx, placementId);

    expect(view.viewer).toBe("NOVA");
    expect(view.tabs).toEqual([
      "overview",
      "schedule",
      "hours",
      "evaluations",
      "incidents",
      "caseNotes",
      "documents",
      "funding",
      "history",
    ]);
    expect(view.placementNumber).toContain("PLC-");
    expect(view.participantName).toContain("Place");
    expect(view.supervisorName).toContain("Manager");
    expect(view.statusLabel).toBe("Onboarding");
    // History resolves actors to display names, never raw ids.
    expect(view.history[0].actorName).toContain("Coordinator");
    expect(JSON.stringify(view.history)).not.toContain(coordinatorId);
  }, 20_000);

  it("shapes the shelter view with Case Notes structurally absent (AC2)", async () => {
    const ctx = await contextFor(managerId);
    const view = await service.getPlacementWorkspace(ctx, placementId);

    expect(view.viewer).toBe("SHELTER");
    expect(view.tabs).not.toContain("caseNotes");
    expect(view.tabs).toHaveLength(8);
    // No internal-only content anywhere in the payload.
    expect(JSON.stringify(view)).not.toMatch(/caseNote|backgroundReview|coordinatorNotes/i);
  }, 20_000);

  it("denies a cross-organization shelter user with no placement data (AC5)", async () => {
    const ctx = await contextFor(otherManagerId);
    await expect(
      service.getPlacementWorkspace(ctx, placementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  }, 20_000);

  it("denies participants the staff workspace; ownership drives My Placement (AC3)", async () => {
    const ownerCtx = await contextFor(ownerUserId);
    await expect(
      service.getPlacementWorkspace(ownerCtx, placementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    const own = await service.getOwnPlacement(ownerCtx);
    expect(own?.stageLabel).toBe("Getting ready to start");
    expect(own?.organizationName).toContain("Host Shelter");
    expect(own?.supervisorName).toContain("Manager");
    // Plain language only: no raw enum names, no blocker codes, no notes.
    expect(JSON.stringify(own)).not.toMatch(
      /ONBOARDING|SHELTER_REVIEW|blocker|caseNote/i,
    );
  }, 20_000);

  it("keeps My Placement to the participant's own record", async () => {
    const otherCtx = await contextFor(otherParticipantUserId);
    const own = await service.getOwnPlacement(otherCtx);
    // The other participant owns the terminal placement, not the main one.
    expect(own?.stageLabel).toBe("Ended");
    expect(own?.placementNumber).toContain("DONE");
  }, 20_000);

  it("renders terminal placements as closed history (AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getPlacementWorkspace(ctx, terminalPlacementId);

    expect(view.isTerminal).toBe(true);
    const last = view.timeline[view.timeline.length - 1];
    expect(last).toMatchObject({ state: "current" });
    expect(last.label).toBe("Withdrawn");
    // Withdrawn from Shelter Review: Approved onward never renders as past.
    const approved = view.timeline.find((stage) => stage.label === "Approved");
    expect(approved?.state).toBe("upcoming");
  }, 20_000);

  it("scopes the shelter placements list by organization", async () => {
    const managerCtx = await contextFor(managerId);
    const rows = await service.listShelterPlacements(managerCtx);
    expect(rows.some((row) => row.id === placementId)).toBe(true);

    const otherCtx = await contextFor(otherManagerId);
    expect(await service.listShelterPlacements(otherCtx)).toHaveLength(0);
  }, 20_000);
});
