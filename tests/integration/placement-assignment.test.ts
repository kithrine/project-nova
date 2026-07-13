import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Site/supervisor/schedule assignment against Neon (Story 5.2): the
 * Draft -> Proposed -> Shelter Review -> Approved path with the
 * change-request return loop, eligibility validation, the conflicting-
 * placement gate, Decimal round-tripping, and role denials.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla52");

describe.skipIf(!hasDatabase)("placement assignment (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let supervisorId: string;
  let otherManagerId: string;
  let hostOrgId: string;
  let siteId: string;
  let otherOrgSiteId: string;
  let placementId: string;
  let participantId: string;
  let enrollmentId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  const goodSchedule = {
    days: [
      { day: "MONDAY", startTime: "09:00", endTime: "13:00" },
      { day: "WEDNESDAY", startTime: "13:00", endTime: "17:30" },
    ],
    weeklyHoursTarget: "20.5",
  };

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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 2 }] },
      },
      include: { sites: true },
    });
    hostOrgId = host.id;
    siteId = host.sites[0].id;
    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: { create: [{ name: testScopedName(runId, "Other Site"), capacity: 1 }] },
      },
      include: { sites: true },
    });
    otherOrgSiteId = otherOrg.sites[0].id;

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
    const supervisor = await prisma.user.create({
      data: {
        email: `${runId}-sup@synthetic.example`,
        displayName: testScopedName(runId, "Supervisor"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    supervisorId = supervisor.id;
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
    const user = await prisma.user.create({
      data: {
        email: `${runId}-part@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Assign",
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
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-ASSIGN`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    participantId = participant.id;
    const enrollment = await prisma.programEnrollment.create({
      data: {
        participantId: participant.id,
        programId: program.id,
        applicationId: application.id,
        status: enums.EnrollmentStatus.READY_FOR_MATCHING,
      },
    });
    enrollmentId = enrollment.id;

    const sourceMatch = await prisma.placementMatch.create({
      data: {
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: siteId,
        status: enums.MatchStatus.APPROVED,
      },
    });
    const placement = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-MAIN`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: siteId,
        sourceMatchId: sourceMatch.id,
      },
    });
    placementId = placement.id;
    await prisma.placementEvent.create({
      data: {
        placementId: placement.id,
        fromStatus: null,
        toStatus: enums.PlacementStatus.DRAFT,
        actorUserId: coordinatorId,
      },
    });
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placementScheduleDay.deleteMany({
      where: {
        schedule: {
          placement: { participant: { person: { user: { email: emails } } } },
        },
      },
    });
    await prisma.placementSchedule.deleteMany({
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
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("rejects sites outside the host organization and ineligible supervisors (AC1/AC2)", async () => {
    const ctx = await contextFor(coordinatorId);

    await expect(
      service.saveAssignment(ctx, placementId, {
        siteId: otherOrgSiteId,
        supervisorId: null,
        coordinatorUserId: null,
        days: [],
        weeklyHoursTarget: null,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("host organization"),
    });

    // The other org's manager is not eligible at THIS organization.
    await expect(
      service.saveAssignment(ctx, placementId, {
        siteId,
        supervisorId: otherManagerId,
        coordinatorUserId: null,
        days: [],
        weeklyHoursTarget: null,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("active Shelter Supervisor or Shelter Manager"),
    });
  }, 20_000);

  it("saves the package with a Decimal-true schedule and names what's missing (AC1)", async () => {
    const ctx = await contextFor(coordinatorId);

    await service.saveAssignment(ctx, placementId, {
      siteId,
      supervisorId,
      coordinatorUserId: null,
      days: goodSchedule.days,
      weeklyHoursTarget: goodSchedule.weeklyHoursTarget,
    });

    const view = await service.getPlacementWorkspace(ctx, placementId);
    expect(view.supervisorName).toContain("Supervisor");
    expect(view.structuredSchedule?.weeklyHoursTarget).toBe("20.5");
    expect(view.structuredSchedule?.days.map((d) => d.dayLabel)).toEqual([
      "Monday",
      "Wednesday",
    ]);
    expect(view.packageMissing).toEqual(["Coordinator of record"]);

    // Propose is gated until the package is complete (AC3).
    await expect(service.proposePlacementPackage(ctx, placementId)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("Coordinator of record"),
    });
  }, 30_000);

  it("blocks proposing while the participant holds another active-tier placement (AC5)", async () => {
    const ctx = await contextFor(coordinatorId);
    await service.saveAssignment(ctx, placementId, {
      siteId,
      supervisorId,
      coordinatorUserId: coordinatorId,
      days: goodSchedule.days,
      weeklyHoursTarget: goodSchedule.weeklyHoursTarget,
    });

    // A conflicting ONBOARDING placement through a separate terminal match.
    const conflictMatch = await prisma.placementMatch.create({
      data: {
        participantId,
        programEnrollmentId: enrollmentId,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        status: enums.MatchStatus.DECLINED,
      },
    });
    const conflict = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-CONF`,
        participantId,
        programEnrollmentId: enrollmentId,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        sourceMatchId: conflictMatch.id,
        status: enums.PlacementStatus.ONBOARDING,
      },
    });

    await expect(service.proposePlacementPackage(ctx, placementId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("one placement at a time"),
    });

    await prisma.placement.delete({ where: { id: conflict.id } });
    await prisma.placementMatch.delete({ where: { id: conflictMatch.id } });
  }, 30_000);

  it("walks Draft -> Proposed -> Shelter Review with both events (AC3)", async () => {
    const ctx = await contextFor(coordinatorId);
    await service.proposePlacementPackage(ctx, placementId);

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
    });
    expect(placement.status).toBe(enums.PlacementStatus.SHELTER_REVIEW);

    const events = await prisma.placementEvent.findMany({
      where: { placementId },
      orderBy: { createdAt: "asc" },
    });
    const path = events.map((event) => `${event.fromStatus ?? "∅"}→${event.toStatus}`);
    expect(path).toContain("DRAFT→PROPOSED");
    expect(path).toContain("PROPOSED→SHELTER_REVIEW");

    // It appears in the shelter's review queue; editing is closed (AC-gate).
    const managerCtx = await contextFor(managerId);
    const reviews = await service.listShelterPackageReviews(managerCtx);
    expect(reviews.some((row) => row.id === placementId)).toBe(true);
    await expect(
      service.saveAssignment(ctx, placementId, {
        siteId,
        supervisorId,
        coordinatorUserId: coordinatorId,
        days: goodSchedule.days,
        weeklyHoursTarget: goodSchedule.weeklyHoursTarget,
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  }, 30_000);

  it("returns the package to Draft with the required note archived (change-request loop)", async () => {
    const managerCtx = await contextFor(managerId);

    await expect(
      service.requestPlacementChanges(managerCtx, placementId, "   "),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("Add a note for the coordinator"),
    });

    await service.requestPlacementChanges(
      managerCtx,
      placementId,
      "Weekend mornings suit our intake schedule better",
    );

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
    });
    expect(placement.status).toBe(enums.PlacementStatus.DRAFT);
    expect(placement.shelterReviewNote).toContain("Weekend mornings");

    const event = await prisma.placementEvent.findFirstOrThrow({
      where: {
        placementId,
        fromStatus: enums.PlacementStatus.SHELTER_REVIEW,
        toStatus: enums.PlacementStatus.DRAFT,
      },
    });
    expect(event.detail).toContain("Weekend mornings");
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "placement.requestChanges", subjectId: placementId },
    });
    expect(JSON.stringify(audit)).not.toContain("Weekend");

    // Re-propose clears the outstanding note (archived in the event trail).
    const ctx = await contextFor(coordinatorId);
    await service.proposePlacementPackage(ctx, placementId);
    const reproposed = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
    });
    expect(reproposed.status).toBe(enums.PlacementStatus.SHELTER_REVIEW);
    expect(reproposed.shelterReviewNote).toBeNull();
  }, 30_000);

  it("lets the Shelter Manager approve the package with its lifecycle event (AC4)", async () => {
    // A supervisor may not approve; a cross-org manager may not either.
    const supervisorCtx = await contextFor(supervisorId);
    await expect(
      service.approvePlacementPackage(supervisorCtx, placementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    const otherCtx = await contextFor(otherManagerId);
    await expect(
      service.approvePlacementPackage(otherCtx, placementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    // And the coordinator cannot take the shelter's gate.
    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(
      service.approvePlacementPackage(coordinatorCtx, placementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    const managerCtx = await contextFor(managerId);
    await service.approvePlacementPackage(managerCtx, placementId);

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
    });
    expect(placement.status).toBe(enums.PlacementStatus.APPROVED);
    const event = await prisma.placementEvent.findFirstOrThrow({
      where: {
        placementId,
        fromStatus: enums.PlacementStatus.SHELTER_REVIEW,
        toStatus: enums.PlacementStatus.APPROVED,
      },
    });
    expect(event.actorUserId).toBe(managerId);
  }, 30_000);

  it("preserves assignment history when a supervisor's membership later deactivates (AC6)", async () => {
    await prisma.membership.updateMany({
      where: { userId: supervisorId, organizationId: hostOrgId },
      data: { status: enums.ActiveStatus.INACTIVE },
    });

    const ctx = await contextFor(coordinatorId);
    const view = await service.getPlacementWorkspace(ctx, placementId);
    // The assignment stands unchanged — surfacing the gap is 5.5's blocker.
    expect(view.supervisorName).toContain("Supervisor");

    await prisma.membership.updateMany({
      where: { userId: supervisorId, organizationId: hostOrgId },
      data: { status: enums.ActiveStatus.ACTIVE },
    });
  }, 20_000);
});
