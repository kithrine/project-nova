import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Activation blockers against Neon (Story 5.5): the eleven-prerequisite
 * checklist computed from live rows across enrollment, training, the
 * source match, the review package, site onboarding, and funding — plus
 * the conflicting-placement probe, role shaping, and the dashboard's
 * urgent surface. The subject placement walks the real 5.2 -> 5.4
 * pipeline through the service functions so each blocker closes the way
 * it does in production.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla55");

describe.skipIf(!hasDatabase)("activation blockers (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let supervisorUserId: string;
  let hostOrgId: string;
  let siteId: string;
  let placementId: string;
  let enrollmentId: string;
  let trainingProgramId: string;
  let fundingSourceId: string;
  let conflictPlacementId: string;
  let conflictActiveNumber: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function openTitles(placement: string): Promise<string[]> {
    const view = await service.getPlacementWorkspace(
      await contextFor(coordinatorId),
      placement,
    );
    expect(view.activation).not.toBeNull();
    return view.activation!.open.map((item) => item.title);
  }

  /** Create one participant chain and a placement from an approved match. */
  async function createPlacementChain(
    slug: string,
    programId: string,
    placementStatus: keyof typeof import("@/generated/prisma/enums").PlacementStatus,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${slug}@synthetic.example`,
        displayName: testScopedName(runId, slug),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: slug,
            legalLastName: testScopedName(runId, "Subject"),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
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
        programId,
        applicationId: application.id,
        status: enums.EnrollmentStatus.READY_FOR_MATCHING,
      },
    });
    const match = await prisma.placementMatch.create({
      data: {
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        status: enums.MatchStatus.APPROVED,
        participantDecision: enums.ParticipantMatchDecision.ACCEPTED,
        shelterDecision: enums.ShelterMatchDecision.APPROVED,
      },
    });
    const placement = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        sourceMatchId: match.id,
        status: enums.PlacementStatus[placementStatus],
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
    return { participant, enrollment, match, placement };
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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 3 }] },
      },
      include: { sites: true },
    });
    hostOrgId = host.id;
    siteId = host.sites[0].id;

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
    supervisorUserId = supervisor.id;

    // One required training so the Layer 1 prerequisite has real teeth.
    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });
    const training = await prisma.trainingProgram.create({
      data: {
        programId: program.id,
        code: `${runId}-CORE`,
        name: testScopedName(runId, "Core Training"),
        description: "Synthetic required training.",
        requiredForMatching: true,
        sortOrder: 1,
      },
    });
    trainingProgramId = training.id;

    const fundingSource = await prisma.fundingSource.create({
      data: {
        name: testScopedName(runId, "Grant"),
        kind: enums.FundingSourceKind.GRANT,
      },
    });
    fundingSourceId = fundingSource.id;

    const subject = await createPlacementChain("activate", program.id, "DRAFT");
    placementId = subject.placement.id;
    enrollmentId = subject.enrollment.id;

    // A second participant with an ACTIVE placement plus a DRAFT one —
    // the conflicting-active-placement case (AC4). The DRAFT sits outside
    // the active-tier partial index, so both rows can exist.
    const conflictActive = await createPlacementChain("occupied", program.id, "ACTIVE");
    conflictActiveNumber = conflictActive.placement.placementNumber;
    const secondApplication = await prisma.application.create({
      data: {
        personId: (await prisma.participant.findUniqueOrThrow({
          where: { id: conflictActive.participant.id },
          select: { personId: true },
        })).personId,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-OCCUP2`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const secondEnrollment = await prisma.programEnrollment.create({
      data: {
        participantId: conflictActive.participant.id,
        programId: program.id,
        applicationId: secondApplication.id,
        status: enums.EnrollmentStatus.READY_FOR_MATCHING,
      },
    });
    const secondMatch = await prisma.placementMatch.create({
      data: {
        participantId: conflictActive.participant.id,
        programEnrollmentId: secondEnrollment.id,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        status: enums.MatchStatus.APPROVED,
        participantDecision: enums.ParticipantMatchDecision.ACCEPTED,
        shelterDecision: enums.ShelterMatchDecision.APPROVED,
      },
    });
    const conflictDraft = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-OCCUP2`,
        participantId: conflictActive.participant.id,
        programEnrollmentId: secondEnrollment.id,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        sourceMatchId: secondMatch.id,
        status: enums.PlacementStatus.DRAFT,
      },
    });
    conflictPlacementId = conflictDraft.id;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.fundingAssignment.deleteMany({ where: byParticipantUser });
    await prisma.onboardingTask.deleteMany({ where: byParticipantUser });
    await prisma.placementScheduleDay.deleteMany({
      where: { schedule: byParticipantUser },
    });
    await prisma.placementSchedule.deleteMany({ where: byParticipantUser });
    await prisma.placementEvent.deleteMany({ where: byParticipantUser });
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
    await prisma.trainingEnrollmentEvent.deleteMany({
      where: {
        trainingEnrollment: {
          programEnrollment: { participant: { person: { user: { email: emails } } } },
        },
      },
    });
    await prisma.trainingEnrollment.deleteMany({
      where: {
        programEnrollment: { participant: { person: { user: { email: emails } } } },
      },
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
    await prisma.trainingProgram.deleteMany({ where: { code: { contains: runId } } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.fundingSource.deleteMany({ where: { name: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("reports exactly the unmet prerequisites for a fresh draft, in order (AC1)", async () => {
    const view = await service.getPlacementWorkspace(
      await contextFor(coordinatorId),
      placementId,
    );
    expect(view.activation!.open.map((item) => item.title)).toEqual([
      "Supervisor and coordinator assigned",
      "Portable training and required certifications complete",
      "Host-site safety orientation and assigned-task competency confirmed",
      "Schedule confirmed",
      "Active funding assignment",
    ]);
    // Each open item links to its resolving tab or surface.
    const hrefs = Object.fromEntries(
      view.activation!.open.map((item) => [item.key, item.href]),
    );
    expect(hrefs.funding).toBe(
      `/operations/placements/records/${placementId}?tab=funding`,
    );
    expect(hrefs.siteOnboarding).toBe(
      `/operations/placements/records/${placementId}#placement-onboarding`,
    );
    expect(hrefs.portableTraining).toBe(
      `/operations/enrollments/${enrollmentId}#training`,
    );
  });

  it("closes each blocker as the real 5.2-5.4 pipeline resolves it (AC3), reaching empty (AC2)", { timeout: 60_000 }, async () => {
    const coordinator = await contextFor(coordinatorId);
    const manager = await contextFor(managerId);

    // Package assigned and confirmed through the shelter's review gate.
    await service.saveAssignment(coordinator, placementId, {
      siteId,
      supervisorId: supervisorUserId,
      coordinatorUserId: coordinatorId,
      days: [{ day: "MONDAY", startTime: "09:00", endTime: "13:00" }],
      weeklyHoursTarget: "12",
    });
    await service.proposePlacementPackage(coordinator, placementId);
    await service.approvePlacementPackage(manager, placementId);
    await service.initiatePlacementOnboarding(coordinator, placementId);

    let titles = await openTitles(placementId);
    expect(titles).toEqual([
      "Portable training and required certifications complete",
      "Host-site safety orientation and assigned-task competency confirmed",
      "Active funding assignment",
    ]);

    // The dashboard's urgent surface sees the placement at the gate.
    const urgent = await service.listUrgentBlockers(coordinator);
    const row = urgent.find((entry) => entry.placementId === placementId);
    expect(row).toBeDefined();
    expect(row!.openTitles).toContain("Active funding assignment");

    // Layer 1 closes when the required training completes (Epic 3 data).
    await prisma.trainingEnrollment.create({
      data: {
        programEnrollmentId: enrollmentId,
        trainingProgramId,
        status: enums.TrainingEnrollmentStatus.COMPLETED,
        enrolledAt: new Date("2026-06-01T00:00:00Z"),
        completedAt: new Date("2026-06-20T00:00:00Z"),
        // The 3.4 CHECK constraint holds COMPLETED rows to their full
        // verification trail — method, verifier, and timestamp.
        completionMethod: enums.TrainingCompletionMethod.PROVIDER_VERIFICATION,
        completionVerifiedByUserId: coordinatorId,
        completionVerifiedAt: new Date("2026-06-20T00:00:00Z"),
      },
    });
    // Layer 2 closes as staff verify the site checklist (5.4 data).
    const tasks = await prisma.onboardingTask.findMany({
      where: { placementId, required: true },
      select: { id: true },
    });
    for (const task of tasks) {
      await service.completePlacementTask(coordinator, task.id);
    }
    titles = await openTitles(placementId);
    expect(titles).toEqual(["Active funding assignment"]);

    // Funding closes the last one (5.3 data) — the list reaches empty.
    await service.assignFunding(coordinator, placementId, {
      fundingSourceId,
      startDate: new Date("2026-08-01T00:00:00Z"),
      hourlyRate: "17.50",
      hoursCap: null,
    });
    expect(await openTitles(placementId)).toEqual([]);

    // And the urgent surface releases it.
    const urgentAfter = await service.listUrgentBlockers(coordinator);
    expect(
      urgentAfter.find((entry) => entry.placementId === placementId),
    ).toBeUndefined();
  });

  it("names the conflicting active placement (AC4)", async () => {
    const view = await service.getPlacementWorkspace(
      await contextFor(coordinatorId),
      conflictPlacementId,
    );
    const conflict = view.activation!.open.find((item) => item.key === "noConflict");
    expect(conflict).toBeDefined();
    expect(conflict!.title).toBe("No conflicting active placement");
    expect(conflict!.action).toContain(conflictActiveNumber);
  });

  it("shapes the checklist Nova-side only — shelter viewers never receive it", async () => {
    const view = await service.getPlacementWorkspace(
      await contextFor(managerId),
      placementId,
    );
    expect(view.viewer).toBe("SHELTER");
    expect(view.activation).toBeNull();
  });

  it("denies the urgent surface outside Nova scope", async () => {
    await expect(
      service.listUrgentBlockers(await contextFor(managerId)),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  // --- Story 5.6: activate placement -----------------------------------------

  it("re-validates inside the transaction: a blocked activation rejects with no partial state (5.6 AC2)", { timeout: 30_000 }, async () => {
    const coordinator = await contextFor(coordinatorId);

    // Reopen one prerequisite AFTER the workspace could have shown "all
    // clear" — the in-transaction re-check must catch it.
    await service.endFundingAssignment(
      coordinator,
      placementId,
      new Date("2026-09-30T00:00:00.000Z"),
    );
    await expect(
      service.activatePlacement(coordinator, placementId),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("Active funding assignment"),
    });

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
      include: { events: true },
    });
    expect(placement.status).toBe(enums.PlacementStatus.ONBOARDING);
    expect(
      placement.events.filter(
        (event) => event.toStatus === enums.PlacementStatus.ACTIVE,
      ),
    ).toHaveLength(0);

    // Restore funding for the activation tests below.
    await service.assignFunding(coordinator, placementId, {
      fundingSourceId,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      hourlyRate: "17.50",
      hoursCap: null,
    });
  });

  it("denies activation without placement.activate, server-side (5.6 AC6)", async () => {
    for (const userId of [managerId, supervisorUserId]) {
      await expect(
        service.activatePlacement(await contextFor(userId), placementId),
      ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    }
  });

  it("activates exactly once under concurrency, with one event and the start date (5.6 AC1/AC3/AC5)", { timeout: 30_000 }, async () => {
    const coordinator = await contextFor(coordinatorId);

    const results = await Promise.allSettled([
      service.activatePlacement(coordinator, placementId),
      service.activatePlacement(coordinator, placementId),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      code: expect.stringMatching(/CONFLICT|LIFECYCLE/),
    });

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(placement.status).toBe(enums.PlacementStatus.ACTIVE);
    expect(placement.startDate).not.toBeNull();
    expect(
      placement.events.filter(
        (event) =>
          event.fromStatus === enums.PlacementStatus.ONBOARDING &&
          event.toStatus === enums.PlacementStatus.ACTIVE,
      ),
    ).toHaveLength(1);

    // The one-active-placement partial unique index stands beneath the
    // application checks (5.6 AC4): a second active-tier row is refused
    // at the database. A fresh source match isolates the assertion to
    // the partial index (sourceMatchId has its own unique constraint).
    const dupeMatch = await prisma.placementMatch.create({
      data: {
        participantId: placement.participantId,
        programEnrollmentId: placement.programEnrollmentId,
        hostOrganizationId: placement.hostOrganizationId,
        organizationSiteId: placement.organizationSiteId,
        status: enums.MatchStatus.APPROVED,
        participantDecision: enums.ParticipantMatchDecision.ACCEPTED,
        shelterDecision: enums.ShelterMatchDecision.APPROVED,
      },
    });
    await expect(
      prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-DUPE01`,
          participantId: placement.participantId,
          programEnrollmentId: placement.programEnrollmentId,
          hostOrganizationId: placement.hostOrganizationId,
          organizationSiteId: placement.organizationSiteId,
          sourceMatchId: dupeMatch.id,
          status: enums.PlacementStatus.ONBOARDING,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    // Past the gate, the workspace no longer computes a checklist
    // (5.5 AC6) and the timeline reads Active.
    const view = await service.getPlacementWorkspace(coordinator, placementId);
    expect(view.activation).toBeNull();
    expect(view.statusLabel).toBe("Active");
  });

  it("rejects a replayed activation once Active (5.6 AC2)", async () => {
    await expect(
      service.activatePlacement(await contextFor(coordinatorId), placementId),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  });
});
