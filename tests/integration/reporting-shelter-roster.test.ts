import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Shelter roster against Neon (Story 7.3): all host organizations for
 * Nova viewers — including zero-placement shelters — organization scope
 * for a Shelter Manager, ACTIVE-tier counts only, staff contacts, and no
 * participant data anywhere in the payload.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rpt73");

describe.skipIf(!hasDatabase)("shelter roster (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/reporting-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let supervisorUserId: string;
  let participantUserId: string;
  let hostOneId: string;
  let hostTwoId: string;

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
    service = await import("@/server/services/reporting-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const hostOne = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Aspen Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Aspen Main"),
              city: "Denver",
              region: "CO",
              capacity: 4,
            },
            {
              name: testScopedName(runId, "Aspen Annex"),
              city: "Denver",
              region: "CO",
              capacity: 2,
            },
          ],
        },
      },
      include: { sites: { orderBy: { name: "asc" } } },
    });
    hostOneId = hostOne.id;
    // The zero-placement shelter: it must still appear with zero counts (AC3).
    const hostTwo = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Birchwood Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Birchwood Main"),
              city: "Boulder",
              region: "CO",
              capacity: 3,
            },
          ],
        },
      },
    });
    hostTwoId = hostTwo.id;

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
          create: { organizationId: hostOne.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    managerId = manager.id;
    const supervisor = await prisma.user.create({
      data: {
        email: `${runId}-sup@synthetic.example`,
        displayName: testScopedName(runId, "Supervisor"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: hostOne.id, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    supervisorUserId = supervisor.id;
    // A deactivated supervisor must not appear (ACTIVE memberships only).
    await prisma.user.create({
      data: {
        email: `${runId}-oldsup@synthetic.example`,
        displayName: testScopedName(runId, "Former Supervisor"),
        isSynthetic: true,
        memberships: {
          create: {
            organizationId: hostOne.id,
            role: enums.Role.SHELTER_SUPERVISOR,
            status: enums.ActiveStatus.INACTIVE,
          },
        },
      },
    });

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    let participantIndex = 0;
    async function createPlacement(siteId: string, status: "ACTIVE" | "PAUSED" | "WITHDRAWN" | "DRAFT") {
      participantIndex += 1;
      const tag = `p${participantIndex}`;
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Roster",
              legalLastName: testScopedName(runId, tag),
              dateOfBirth: new Date("1990-01-01T00:00:00Z"),
            },
          },
        },
      });
      const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
      const application = await prisma.application.create({
        data: {
          personId: person.id,
          applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
          status: enums.ApplicationStatus.ACCEPTED,
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
      });
      const participant = await prisma.participant.create({ data: { personId: person.id } });
      const enrollment = await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId: program.id,
          applicationId: application.id,
          status: enums.EnrollmentStatus.READY_FOR_MATCHING,
        },
      });
      const sourceMatch = await prisma.placementMatch.create({
        data: {
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: hostOne.id,
          organizationSiteId: siteId,
          status: enums.MatchStatus.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-6).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: hostOne.id,
          organizationSiteId: siteId,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus[status],
        },
      });
      return { userId: user.id, placementId: placement.id };
    }

    const mainSite = hostOne.sites.find((s) => s.name.includes("Aspen Main"))!;
    const annexSite = hostOne.sites.find((s) => s.name.includes("Aspen Annex"))!;

    const first = await createPlacement(mainSite.id, "ACTIVE");
    participantUserId = first.userId;
    await createPlacement(mainSite.id, "PAUSED");
    // Terminal and pre-onboarding placements never count.
    await createPlacement(annexSite.id, "WITHDRAWN");
    await createPlacement(annexSite.id, "DRAFT");
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placement.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.participant.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.application.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.person.deleteMany({ where: { user: { email: emails } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
  });

  it("lists every participating shelter for a coordinator, including zero-placement ones (AC1/AC3)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getShelterRoster(ctx);

    expect(view.novaScope).toBe(true);
    const aspen = view.organizations.find((o) => o.organizationId === hostOneId);
    const birchwood = view.organizations.find((o) => o.organizationId === hostTwoId);
    expect(aspen).toBeDefined();
    expect(birchwood).toBeDefined();

    // ACTIVE-tier counts only: ACTIVE + PAUSED count; WITHDRAWN and DRAFT never do.
    expect(aspen?.activePlacementCount).toBe(2);
    const mainSite = aspen?.sites.find((s) => s.name.includes("Aspen Main"));
    const annexSite = aspen?.sites.find((s) => s.name.includes("Aspen Annex"));
    expect(mainSite).toMatchObject({ capacity: 4, activePlacementCount: 2 });
    expect(annexSite).toMatchObject({ capacity: 2, activePlacementCount: 0 });

    // The zero-placement shelter shows zero, never omitted.
    expect(birchwood?.activePlacementCount).toBe(0);
    expect(birchwood?.sites[0]).toMatchObject({ capacity: 3, activePlacementCount: 0 });
  });

  it("includes the Shelter Manager contact and only ACTIVE supervisor memberships (AC1)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getShelterRoster(ctx);

    const aspen = view.organizations.find((o) => o.organizationId === hostOneId);
    expect(aspen?.managers).toHaveLength(1);
    expect(aspen?.managers[0].name).toContain("Manager");
    expect(aspen?.managers[0].email).toBe(`${runId}-mgr@synthetic.example`);
    expect(aspen?.supervisorNames.join(", ")).toContain("Supervisor");
    expect(aspen?.supervisorNames.join(", ")).not.toContain("Former Supervisor");
  });

  it("scopes a Shelter Manager to their own organization only (AC2)", async () => {
    const ctx = await contextFor(managerId);
    const view = await service.getShelterRoster(ctx);

    expect(view.novaScope).toBe(false);
    expect(view.organizations.map((o) => o.organizationId)).toEqual([hostOneId]);
  });

  it("contains no participant data — the roster is organization-level (AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getShelterRoster(ctx);
    const payload = JSON.stringify(view);

    expect(payload).not.toMatch(/legalFirstName|legalLastName|participantName/);
    expect(payload).not.toMatch(/background/i);
    expect(payload).not.toMatch(/caseNote/i);
    expect(payload).not.toMatch(/dateOfBirth|governmentId|\bssn\b/i);
    // Participant fixture users' emails never appear (staff contacts only).
    expect(payload).not.toContain("-p1@synthetic.example");
  });

  it("denies supervisors and participants (deny-by-default)", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    const supervisorCtx = await contextFor(supervisorUserId);
    await expect(service.getShelterRoster(supervisorCtx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    const participantCtx = await contextFor(participantUserId);
    await expect(service.getShelterRoster(participantCtx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
