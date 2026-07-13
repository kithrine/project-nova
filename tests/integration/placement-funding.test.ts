import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Funding assignments against Neon (Story 5.3; ADR-010): one ACTIVE
 * assignment per placement (application check + partial unique index),
 * end-then-replace with history preserved, Decimal round-tripping, and
 * server-side permission denial.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("plf53");

describe.skipIf(!hasDatabase)("funding assignments (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let grantAdminId: string;
  let managerId: string;
  let placementId: string;
  let sourceAId: string;
  let sourceBId: string;

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
        sites: { create: [{ name: testScopedName(runId, "Site"), capacity: 1 }] },
      },
      include: { sites: true },
    });

    const grantAdmin = await prisma.user.create({
      data: {
        email: `${runId}-ga@synthetic.example`,
        displayName: testScopedName(runId, "Grant Admin"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.GRANT_ADMINISTRATOR },
        },
      },
    });
    grantAdminId = grantAdmin.id;
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

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });
    const user = await prisma.user.create({
      data: {
        email: `${runId}-part@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Fund",
            legalLastName: testScopedName(runId, "Subject"),
            dateOfBirth: new Date("1991-01-01T00:00:00Z"),
          },
        },
      },
    });
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-FUND`,
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
      },
    });
    const sourceMatch = await prisma.placementMatch.create({
      data: {
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        status: enums.MatchStatus.APPROVED,
      },
    });
    const placement = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-FUND`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        sourceMatchId: sourceMatch.id,
        status: enums.PlacementStatus.ONBOARDING,
      },
    });
    placementId = placement.id;

    const sourceA = await prisma.fundingSource.create({
      data: {
        name: testScopedName(runId, "Grant A"),
        kind: enums.FundingSourceKind.GRANT,
        status: enums.ActiveStatus.ACTIVE,
      },
    });
    sourceAId = sourceA.id;
    const sourceB = await prisma.fundingSource.create({
      data: {
        name: testScopedName(runId, "Grant B"),
        kind: enums.FundingSourceKind.GRANT,
        status: enums.ActiveStatus.ACTIVE,
      },
    });
    sourceBId = sourceB.id;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.fundingAssignment.deleteMany({
      where: { placement: { participant: { person: { user: { email: emails } } } } },
    });
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
    await prisma.fundingSource.deleteMany({ where: { name: { contains: runId } } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("assigns exactly one ACTIVE assignment with Decimal-true amounts (AC1/AC6)", async () => {
    const ctx = await contextFor(grantAdminId);
    await service.assignFunding(ctx, placementId, {
      fundingSourceId: sourceAId,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      hourlyRate: "18.50",
      hoursCap: "320.25",
    });

    const row = await prisma.fundingAssignment.findFirstOrThrow({
      where: { placementId },
    });
    expect(row.status).toBe(enums.FundingAssignmentStatus.ACTIVE);
    expect(row.hourlyRate?.toString()).toBe("18.5");
    expect(row.hoursCap?.toString()).toBe("320.25");
    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "funding.assign", subjectId: placementId },
    });

    // The workspace Funding tab and Overview reflect the active assignment.
    const view = await service.getPlacementWorkspace(ctx, placementId);
    expect(view.funding.active?.fundingSourceName).toContain("Grant A");
    expect(view.funding.active?.hourlyRate).toBe("18.5");
    expect(view.fundingSummary).toContain("(active)");
  }, 20_000);

  it("rejects a second active assignment at both layers (AC2)", async () => {
    const ctx = await contextFor(grantAdminId);
    await expect(
      service.assignFunding(ctx, placementId, {
        fundingSourceId: sourceBId,
        startDate: new Date("2026-08-15T00:00:00.000Z"),
        hourlyRate: null,
        hoursCap: null,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("one active assignment at a time"),
    });

    // Direct insert bypassing the service: the partial index rejects it.
    await expect(
      prisma.fundingAssignment.create({
        data: {
          placementId,
          fundingSourceId: sourceBId,
          startDate: new Date("2026-08-15T00:00:00.000Z"),
          assignedByUserId: grantAdminId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  }, 20_000);

  it("ends and replaces with full history preserved (AC3/AC4)", async () => {
    const ctx = await contextFor(grantAdminId);

    await expect(
      service.endFundingAssignment(ctx, placementId, new Date("2026-07-01T00:00:00.000Z")),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("cannot be before"),
    });

    await service.endFundingAssignment(
      ctx,
      placementId,
      new Date("2026-09-30T00:00:00.000Z"),
    );
    await service.assignFunding(ctx, placementId, {
      fundingSourceId: sourceBId,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      hourlyRate: null,
      hoursCap: null,
    });

    const view = await service.getPlacementWorkspace(ctx, placementId);
    expect(view.funding.active?.fundingSourceName).toContain("Grant B");
    expect(view.funding.history).toHaveLength(2);
    const ended = view.funding.history.find((a) => a.statusLabel === "Ended");
    expect(ended?.fundingSourceName).toContain("Grant A");
    expect(ended?.endDateLabel).toContain("September 30, 2026");

    const activeCount = await prisma.fundingAssignment.count({
      where: { placementId, status: enums.FundingAssignmentStatus.ACTIVE },
    });
    expect(activeCount).toBe(1);
  }, 30_000);

  it("denies non-holders server-side regardless of client state (AC5)", async () => {
    const managerCtx = await contextFor(managerId);
    await expect(
      service.assignFunding(managerCtx, placementId, {
        fundingSourceId: sourceAId,
        startDate: new Date("2026-10-02T00:00:00.000Z"),
        hourlyRate: null,
        hoursCap: null,
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    await expect(
      service.endFundingAssignment(
        managerCtx,
        placementId,
        new Date("2026-10-02T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    // The shelter's workspace view carries no assign controls or options.
    const view = await service.getPlacementWorkspace(managerCtx, placementId);
    expect(view.funding.viewerCanAssign).toBe(false);
    expect(view.funding.sourceOptions).toHaveLength(0);
  }, 20_000);
});
