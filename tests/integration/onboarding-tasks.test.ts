import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Onboarding task completion against Neon (Story 3.3): participant
 * own-completion via ownership, staff-only enforcement, cross-enrollment
 * denial, staff completion/reopen with their audit trail, and transition
 * guards. Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("tsk33");

describe.skipIf(!hasDatabase)("onboarding tasks (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/enrollment-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let participantUserId: string;
  let strangerUserId: string;
  let coordinatorId: string;
  let shelterUserId: string;
  let enrollmentId: string;
  let completableTaskId: string;
  let staffOnlyTaskId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  /** A person + participant + ONBOARDING enrollment, built directly (3.1 covers the accept path). */
  async function createEnrolledParticipant(tag: string) {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, tag),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Task",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1990-02-02T00:00:00Z"),
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
    const program = await prisma.program.upsert({
      where: { code: "NOVA-TE" },
      update: {},
      create: { id: "program_nova_te", code: "NOVA-TE", name: "Transitional Employment Program" },
    });
    const enrollment = await prisma.programEnrollment.create({
      data: {
        participantId: participant.id,
        programId: program.id,
        applicationId: application.id,
      },
    });
    return { userId: user.id, enrollmentId: enrollment.id };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/enrollment-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const shelter = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Shelter Org"),
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
    const shelterUser = await prisma.user.create({
      data: {
        email: `${runId}-shelter@synthetic.example`,
        displayName: testScopedName(runId, "Shelter"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: shelter.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    coordinatorId = coordinator.id;
    shelterUserId = shelterUser.id;

    const enrolled = await createEnrolledParticipant("owner");
    participantUserId = enrolled.userId;
    enrollmentId = enrolled.enrollmentId;
    const stranger = await createEnrolledParticipant("stranger");
    strangerUserId = stranger.userId;

    const completable = await prisma.onboardingTask.create({
      data: {
        enrollmentId,
        title: testScopedName(runId, "Confirm contact info"),
        description: "Confirm your details.",
        required: true,
        participantCompletable: true,
        sortOrder: 1,
      },
    });
    const staffOnly = await prisma.onboardingTask.create({
      data: {
        enrollmentId,
        title: testScopedName(runId, "Verify identity documents"),
        description: "Nova staff verify originals.",
        required: true,
        participantCompletable: false,
        sortOrder: 2,
      },
    });
    completableTaskId = completable.id;
    staffOnlyTaskId = staffOnly.id;
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: { in: [coordinatorId, participantUserId, strangerUserId, shelterUserId] } },
    });
    await prisma.onboardingTask.deleteMany({
      where: { enrollment: { participant: { person: { user: { email: emails } } } } },
    });
    await prisma.enrollmentEvent.deleteMany({
      where: { enrollment: { participant: { person: { user: { email: emails } } } } },
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
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 30_000);

  it("lets the participant complete their own participant-completable task (AC1)", async () => {
    const ctx = await contextFor(participantUserId);
    await service.completeOwnOnboardingTask(ctx, completableTaskId);

    const task = await prisma.onboardingTask.findUniqueOrThrow({
      where: { id: completableTaskId },
    });
    expect(task.status).toBe(enums.OnboardingTaskStatus.COMPLETE);
    expect(task.completedByUserId).toBe(participantUserId);
    expect(task.completedAt).toBeInstanceOf(Date);

    // Participant self-completion is not audited (staff actions are).
    expect(
      await prisma.auditEvent.count({ where: { subjectId: completableTaskId } }),
    ).toBe(0);

    // Completing again is a lifecycle error, never a silent overwrite.
    await expect(
      service.completeOwnOnboardingTask(ctx, completableTaskId),
    ).rejects.toBeInstanceOf(errors.LifecycleError);
  });

  it("denies the participant on a staff-only task, server-side (AC2)", async () => {
    const ctx = await contextFor(participantUserId);
    await expect(
      service.completeOwnOnboardingTask(ctx, staffOnlyTaskId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });

  it("denies a task outside the requester's own enrollment as a plain 404 (AC5)", async () => {
    const strangerCtx = await contextFor(strangerUserId);
    await expect(
      service.completeOwnOnboardingTask(strangerCtx, staffOnlyTaskId),
    ).rejects.toBeInstanceOf(errors.NotFoundError);
    await expect(
      service.completeOwnOnboardingTask(strangerCtx, completableTaskId),
    ).rejects.toBeInstanceOf(errors.NotFoundError);
  });

  it("lets a coordinator complete a staff-only task, audited (AC3)", async () => {
    const ctx = await contextFor(coordinatorId);
    await service.completeOnboardingTaskAsStaff(ctx, staffOnlyTaskId);

    const task = await prisma.onboardingTask.findUniqueOrThrow({
      where: { id: staffOnlyTaskId },
    });
    expect(task.status).toBe(enums.OnboardingTaskStatus.COMPLETE);
    expect(task.completedByUserId).toBe(coordinatorId);

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "onboardingTask.complete", subjectId: staffOnlyTaskId },
    });
    expect(audit.actorUserId).toBe(coordinatorId);
  });

  it("reopens a task completed in error: audited, outstanding again (AC4)", async () => {
    const ctx = await contextFor(coordinatorId);

    // Reopening a Not Started task is a lifecycle error.
    const untouched = await prisma.onboardingTask.create({
      data: {
        enrollmentId,
        title: testScopedName(runId, "Extra task"),
        description: "Extra.",
        required: false,
        participantCompletable: true,
        sortOrder: 3,
      },
    });
    await expect(service.reopenOnboardingTask(ctx, untouched.id)).rejects.toBeInstanceOf(
      errors.LifecycleError,
    );

    await service.reopenOnboardingTask(ctx, staffOnlyTaskId);
    const task = await prisma.onboardingTask.findUniqueOrThrow({
      where: { id: staffOnlyTaskId },
    });
    expect(task.status).toBe(enums.OnboardingTaskStatus.NOT_STARTED);
    expect(task.completedAt).toBeNull();
    expect(task.completedByUserId).toBeNull();

    // The correction preserves lifecycle history: the reopen audit event
    // snapshots who had completed the task and when.
    const reopenAudit = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "onboardingTask.reopen", subjectId: staffOnlyTaskId },
    });
    expect(reopenAudit.detail).toContain(`by=${coordinatorId}`);
    expect(reopenAudit.detail).toMatch(/at=\d{4}-\d{2}-\d{2}T/);

    // The reopened task counts as outstanding again in the summary.
    const participantCtx = await contextFor(participantUserId);
    const summary = await service.getOwnOnboardingSummary(participantCtx);
    expect(summary?.totalCount).toBe(3);
    expect(summary?.completeCount).toBe(1); // only the participant's own completion
  });

  it("denies staff actions to users without the permissions", async () => {
    const shelterCtx = await contextFor(shelterUserId);
    await expect(
      service.completeOnboardingTaskAsStaff(shelterCtx, staffOnlyTaskId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
    await expect(
      service.reopenOnboardingTask(shelterCtx, completableTaskId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });
});

describe.skipIf(hasDatabase)("onboarding tasks (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
