import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Active Placement Summary against Neon (Story 7.1): in-progress-only
 * rows, organization scoping for shelter viewers, narrowing filters with
 * a live count, and no restricted fields anywhere in the payload.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rpt71");

describe.skipIf(!hasDatabase)("active placement summary (integration)", () => {
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
        name: testScopedName(runId, "Alder Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Alder Site"),
              city: "Denver",
              region: "CO",
              capacity: 4,
            },
          ],
        },
      },
      include: { sites: true },
    });
    hostOneId = hostOne.id;
    const hostTwo = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Birch Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Birch Site"),
              city: "Boulder",
              region: "CO",
              capacity: 2,
            },
          ],
        },
      },
      include: { sites: true },
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

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    let participantIndex = 0;
    async function createPlacement(options: {
      host: { id: string; siteId: string };
      status:
        | "DRAFT"
        | "ONBOARDING"
        | "ACTIVE"
        | "PAUSED"
        | "WITHDRAWN";
      supervisorId?: string;
      coordinatorUserId?: string;
      startDate?: string;
    }) {
      participantIndex += 1;
      const tag = `p${participantIndex}`;
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Report",
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
          hostOrganizationId: options.host.id,
          organizationSiteId: options.host.siteId,
          status: enums.MatchStatus.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-6).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: options.host.id,
          organizationSiteId: options.host.siteId,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus[options.status],
          supervisorId: options.supervisorId ?? null,
          coordinatorUserId: options.coordinatorUserId ?? null,
          startDate: options.startDate ? new Date(`${options.startDate}T00:00:00Z`) : null,
        },
      });
      return { placementId: placement.id, userId: user.id };
    }

    const hostOneRef = { id: hostOne.id, siteId: hostOne.sites[0].id };
    const hostTwoRef = { id: hostTwo.id, siteId: hostTwo.sites[0].id };

    // In-progress rows the report must show ...
    const onboarding = await createPlacement({
      host: hostOneRef,
      status: "ONBOARDING",
      supervisorId: supervisor.id,
      coordinatorUserId: coordinator.id,
      startDate: "2026-06-01",
    });
    participantUserId = onboarding.userId;
    await createPlacement({
      host: hostOneRef,
      status: "ACTIVE",
      coordinatorUserId: coordinator.id,
      startDate: "2026-05-04",
    });
    await createPlacement({ host: hostTwoRef, status: "PAUSED" });
    // ... and rows it must exclude: terminal and pre-onboarding (AC4).
    await createPlacement({ host: hostOneRef, status: "WITHDRAWN" });
    await createPlacement({ host: hostOneRef, status: "DRAFT" });
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

  it("lists every in-progress placement for a coordinator and excludes terminal and pre-onboarding rows (AC1/AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getActivePlacementSummary(ctx);

    const scoped = view.rows.filter((row) => row.participantName.includes(runId));
    expect(scoped).toHaveLength(3);
    expect(view.novaScope).toBe(true);

    const stages = scoped.map((row) => row.stage).sort();
    expect(stages).toEqual(["ACTIVE", "ONBOARDING", "PAUSED"]);

    const onboardingRow = scoped.find((row) => row.stage === "ONBOARDING");
    expect(onboardingRow?.stageLabel).toBe("Onboarding");
    expect(onboardingRow?.organizationName).toContain("Alder Shelter");
    expect(onboardingRow?.siteName).toContain("Alder Site");
    expect(onboardingRow?.supervisorName).toContain("Supervisor");
    expect(onboardingRow?.coordinatorName).toContain("Coordinator");
    expect(onboardingRow?.startDateLabel).toBe("Jun 1, 2026");

    // Unassigned staff read as null for the UI's "Not assigned" copy.
    const pausedRow = scoped.find((row) => row.stage === "PAUSED");
    expect(pausedRow?.supervisorName).toBeNull();
    expect(pausedRow?.coordinatorName).toBeNull();
  });

  it("narrows by stage, organization, and coordinator with a matching count (AC2)", async () => {
    const ctx = await contextFor(coordinatorId);

    const byStage = await service.getActivePlacementSummary(ctx, { stage: "ACTIVE" });
    const activeScoped = byStage.rows.filter((r) => r.participantName.includes(runId));
    expect(activeScoped).toHaveLength(1);
    expect(activeScoped[0].stage).toBe("ACTIVE");
    expect(byStage.rows).toHaveLength(byStage.count);

    const byOrg = await service.getActivePlacementSummary(ctx, {
      organizationId: hostTwoId,
    });
    expect(byOrg.rows.map((r) => r.stage)).toEqual(["PAUSED"]);
    expect(byOrg.count).toBe(1);

    const byCoordinator = await service.getActivePlacementSummary(ctx, {
      coordinatorUserId: coordinatorId,
    });
    const coordinatorScoped = byCoordinator.rows.filter((r) =>
      r.participantName.includes(runId),
    );
    expect(coordinatorScoped).toHaveLength(2);

    // Nonsense filter values are ignored, never errors.
    const junkStage = await service.getActivePlacementSummary(ctx, { stage: "WITHDRAWN" });
    expect(junkStage.applied.stage).toBeNull();

    const sorted = await service.getActivePlacementSummary(ctx, {
      sort: "participant",
      direction: "desc",
    });
    const names = sorted.rows
      .filter((r) => r.participantName.includes(runId))
      .map((r) => r.participantName);
    expect([...names].sort().reverse()).toEqual(names);
  });

  it("scopes a Shelter Manager to their own organization, and filters never widen it (AC3)", async () => {
    const ctx = await contextFor(managerId);
    const view = await service.getActivePlacementSummary(ctx);

    expect(view.novaScope).toBe(false);
    expect(view.rows.length).toBeGreaterThanOrEqual(2);
    for (const row of view.rows) {
      expect(row.organizationName).toContain("Alder Shelter");
    }
    // Filter options never leak other organizations' names.
    expect(view.organizationOptions.map((o) => o.value)).toEqual([hostOneId]);

    const widened = await service.getActivePlacementSummary(ctx, {
      organizationId: hostTwoId,
    });
    expect(widened.count).toBe(0);
    expect(widened.rows).toHaveLength(0);
  });

  it("contains no restricted fields anywhere in the payload (AC5)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getActivePlacementSummary(ctx);
    const payload = JSON.stringify(view);

    expect(payload).not.toMatch(/background/i);
    expect(payload).not.toMatch(/caseNote/i);
    expect(payload).not.toMatch(/dateOfBirth|governmentId|\bssn\b/i);
  });

  it("denies participants and shelter supervisors (deny-by-default)", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    const participantCtx = await contextFor(participantUserId);
    await expect(service.getActivePlacementSummary(participantCtx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    const supervisorCtx = await contextFor(supervisorUserId);
    await expect(service.getActivePlacementSummary(supervisorCtx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
