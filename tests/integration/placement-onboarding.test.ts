import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Placement onboarding against Neon (Story 5.4; ADR-017 Layer 2):
 * initiation generates the placement-owned task set (XOR with enrollment,
 * database-enforced), the three completion paths respect role and org
 * scope, actionability is lifecycle-gated, and terminal placements keep
 * incomplete tasks as history.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("plo54");

describe.skipIf(!hasDatabase)("placement onboarding (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let supervisorId: string;
  let otherManagerId: string;
  let ownerUserId: string;
  let otherParticipantUserId: string;
  let placementId: string;
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

    async function participantWithUser(tag: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Onboard",
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
        },
      });
      return { userId: user.id, participant, enrollment };
    }

    const owner = await participantWithUser("owner");
    ownerUserId = owner.userId;
    enrollmentId = owner.enrollment.id;
    const other = await participantWithUser("other");
    otherParticipantUserId = other.userId;

    const sourceMatch = await prisma.placementMatch.create({
      data: {
        participantId: owner.participant.id,
        programEnrollmentId: owner.enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        status: enums.MatchStatus.APPROVED,
      },
    });
    const placement = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-ONB`,
        participantId: owner.participant.id,
        programEnrollmentId: owner.enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        sourceMatchId: sourceMatch.id,
        status: enums.PlacementStatus.APPROVED,
        supervisorId,
      },
    });
    placementId = placement.id;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.onboardingTask.deleteMany({
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

  it("initiates onboarding: task set generated for THIS placement, XOR enforced (AC1/AC2)", async () => {
    const ctx = await contextFor(coordinatorId);
    await service.initiatePlacementOnboarding(ctx, placementId);

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: placementId },
    });
    expect(placement.status).toBe(enums.PlacementStatus.ONBOARDING);
    await prisma.placementEvent.findFirstOrThrow({
      where: {
        placementId,
        fromStatus: enums.PlacementStatus.APPROVED,
        toStatus: enums.PlacementStatus.ONBOARDING,
      },
    });

    const tasks = await prisma.onboardingTask.findMany({ where: { placementId } });
    expect(tasks).toHaveLength(8);
    for (const task of tasks) {
      expect(task.placementId).toBe(placementId);
      expect(task.enrollmentId).toBeNull();
    }

    // The database CHECK rejects dual ownership outright.
    await expect(
      prisma.onboardingTask.create({
        data: {
          placementId,
          enrollmentId,
          title: "dual owner",
          description: "never",
          required: false,
          participantCompletable: false,
        },
      }),
    ).rejects.toThrow();

    // Re-initiating is lifecycle-blocked; the task set never duplicates.
    await expect(
      service.initiatePlacementOnboarding(ctx, placementId),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    expect(await prisma.onboardingTask.count({ where: { placementId } })).toBe(8);
  }, 30_000);

  it("records the participant's own step with actor and timestamp (AC3)", async () => {
    const ownStep = await prisma.onboardingTask.findFirstOrThrow({
      where: { placementId, participantCompletable: true },
      orderBy: { sortOrder: "asc" },
    });

    // Someone else's participant cannot touch it; nor can the owner touch
    // a shelter-verified task.
    const strangerCtx = await contextFor(otherParticipantUserId);
    await expect(
      service.completeOwnPlacementTask(strangerCtx, ownStep.id),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    const staffTask = await prisma.onboardingTask.findFirstOrThrow({
      where: { placementId, participantCompletable: false },
      orderBy: { sortOrder: "asc" },
    });
    const ownerCtx = await contextFor(ownerUserId);
    await expect(
      service.completeOwnPlacementTask(ownerCtx, staffTask.id),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    await service.completeOwnPlacementTask(ownerCtx, ownStep.id);
    const done = await prisma.onboardingTask.findUniqueOrThrow({
      where: { id: ownStep.id },
    });
    expect(done.status).toBe(enums.OnboardingTaskStatus.COMPLETE);
    expect(done.completedByUserId).toBe(ownerUserId);
    expect(done.completedAt).toBeInstanceOf(Date);
  }, 30_000);

  it("lets shelter staff verify shelter tasks only, org-scoped (AC4)", async () => {
    const supervisorCtx = await contextFor(supervisorId);
    const shelterTask = await prisma.onboardingTask.findFirstOrThrow({
      where: {
        placementId,
        participantCompletable: false,
        status: enums.OnboardingTaskStatus.NOT_STARTED,
      },
      orderBy: { sortOrder: "asc" },
    });

    // Cross-org staff and participant-facing tasks are both denied.
    const otherOrgCtx = await contextFor(otherManagerId);
    await expect(
      service.completePlacementTask(otherOrgCtx, shelterTask.id),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    const participantStep = await prisma.onboardingTask.findFirstOrThrow({
      where: {
        placementId,
        participantCompletable: true,
        status: enums.OnboardingTaskStatus.NOT_STARTED,
      },
    });
    await expect(
      service.completePlacementTask(supervisorCtx, participantStep.id),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    await service.completePlacementTask(supervisorCtx, shelterTask.id);
    const done = await prisma.onboardingTask.findUniqueOrThrow({
      where: { id: shelterTask.id },
    });
    expect(done.completedByUserId).toBe(supervisorId);

    // The coordinator may verify any remaining task, including the
    // participant-facing ones (assisted completion).
    const coordinatorCtx = await contextFor(coordinatorId);
    await service.completePlacementTask(coordinatorCtx, participantStep.id);

    // The workspace rolls up remaining required steps for 5.5's blocker.
    const view = await service.getPlacementWorkspace(coordinatorCtx, placementId);
    expect(view.onboarding.tasks).toHaveLength(8);
    expect(view.onboarding.requiredRemaining).toBe(5);
  }, 30_000);

  it("gates actionability by lifecycle and preserves incomplete tasks at terminal (AC6)", async () => {
    const remaining = await prisma.onboardingTask.findFirstOrThrow({
      where: { placementId, status: enums.OnboardingTaskStatus.NOT_STARTED },
    });

    await prisma.placement.update({
      where: { id: placementId },
      data: { status: enums.PlacementStatus.WITHDRAWN },
    });
    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(
      service.completePlacementTask(coordinatorCtx, remaining.id),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });

    // Historical record: incomplete tasks survive the terminal state.
    const tasks = await prisma.onboardingTask.findMany({ where: { placementId } });
    expect(tasks).toHaveLength(8);
    expect(
      tasks.filter((task) => task.status === enums.OnboardingTaskStatus.NOT_STARTED)
        .length,
    ).toBeGreaterThan(0);
  }, 20_000);
});
