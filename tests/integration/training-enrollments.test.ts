import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("trn34");

describe.skipIf(!hasDatabase)("training enrollments (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/training-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");
  let enrollmentId: string;
  let programId: string;
  let coordinatorId: string;
  let shelterUserId: string;
  let participantUserId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function createTrainingProgram(tag: string) {
    return prisma.trainingProgram.create({
      data: {
        programId,
        code: `${runId}-${tag}`,
        name: testScopedName(runId, tag),
        description: "Synthetic portable training.",
        requiredForMatching: true,
      },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/training-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const shelter = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Shelter"),
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
        displayName: testScopedName(runId, "Shelter user"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: shelter.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    coordinatorId = coordinator.id;
    shelterUserId = shelterUser.id;

    const user = await prisma.user.create({
      data: {
        email: `${runId}-participant@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Training",
            legalLastName: testScopedName(runId, "Participant"),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    participantUserId = user.id;
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.toUpperCase()}`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const program = await prisma.program.upsert({
      where: { code: "NOVA-TE" },
      update: {},
      create: {
        id: "program_nova_te",
        code: "NOVA-TE",
        name: "Transitional Employment Program",
      },
    });
    programId = program.id;
    const enrollment = await prisma.programEnrollment.create({
      data: { participantId: participant.id, programId, applicationId: application.id },
    });
    enrollmentId = enrollment.id;
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: { in: [coordinatorId, shelterUserId] } },
    });
    await prisma.trainingEnrollmentEvent.deleteMany({
      where: { trainingEnrollment: { programEnrollmentId: enrollmentId } },
    });
    await prisma.trainingEnrollment.deleteMany({
      where: { programEnrollmentId: enrollmentId },
    });
    await prisma.trainingProgram.deleteMany({ where: { code: { startsWith: runId } } });
    await prisma.programEnrollment.deleteMany({ where: { id: enrollmentId } });
    await prisma.participant.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.application.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.person.deleteMany({ where: { user: { email: emails } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 30_000);

  it("creates one active attempt with a transactional creation event and rejects a duplicate (AC1/AC7)", async () => {
    const program = await createTrainingProgram("create");
    const ctx = await contextFor(coordinatorId);
    const attempt = await service.createTrainingEnrollment(ctx, {
      programEnrollmentId: enrollmentId,
      trainingProgramId: program.id,
      enrolledAt: new Date("2026-07-01T00:00:00Z"),
      expectedCompletionDate: new Date("2026-07-10T00:00:00Z"),
      providerName: "Synthetic Provider",
    });
    expect(
      await prisma.trainingEnrollmentEvent.findMany({
        where: { trainingEnrollmentId: attempt.id },
      }),
    ).toHaveLength(1);
    await expect(
      service.createTrainingEnrollment(ctx, {
        programEnrollmentId: enrollmentId,
        trainingProgramId: program.id,
        enrolledAt: new Date("2026-07-02T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(errors.ConflictError);
  });

  it("transitions atomically, requires evidence, and preserves terminal history (AC2/AC6/AC7)", async () => {
    const program = await createTrainingProgram("lifecycle");
    const ctx = await contextFor(coordinatorId);
    const attempt = await service.createTrainingEnrollment(ctx, {
      programEnrollmentId: enrollmentId,
      trainingProgramId: program.id,
      enrolledAt: new Date("2026-07-01T00:00:00Z"),
    });
    await service.transitionTrainingEnrollment(ctx, {
      trainingEnrollmentId: attempt.id,
      toStatus: enums.TrainingEnrollmentStatus.IN_PROGRESS,
      effectiveDate: new Date("2026-07-02T00:00:00Z"),
    });
    await expect(
      service.transitionTrainingEnrollment(ctx, {
        trainingEnrollmentId: attempt.id,
        toStatus: enums.TrainingEnrollmentStatus.COMPLETED,
        effectiveDate: new Date("2026-07-03T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(errors.ValidationError);
    await service.transitionTrainingEnrollment(ctx, {
      trainingEnrollmentId: attempt.id,
      toStatus: enums.TrainingEnrollmentStatus.COMPLETED,
      effectiveDate: new Date("2026-07-03T00:00:00Z"),
      completionMethod: enums.TrainingCompletionMethod.PROVIDER_VERIFICATION,
    });
    const completed = await prisma.trainingEnrollment.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(completed.completionVerifiedByUserId).toBe(coordinatorId);
    expect(completed.completionMethod).toBe(
      enums.TrainingCompletionMethod.PROVIDER_VERIFICATION,
    );
    expect(
      await prisma.trainingEnrollmentEvent.count({
        where: { trainingEnrollmentId: attempt.id },
      }),
    ).toBe(3);
    await expect(
      service.transitionTrainingEnrollment(ctx, {
        trainingEnrollmentId: attempt.id,
        toStatus: enums.TrainingEnrollmentStatus.WITHDRAWN,
        effectiveDate: new Date("2026-07-04T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(errors.LifecycleError);

    const laterAttempt = await service.createTrainingEnrollment(ctx, {
      programEnrollmentId: enrollmentId,
      trainingProgramId: program.id,
      enrolledAt: new Date("2026-07-05T00:00:00Z"),
    });
    expect(laterAttempt.id).not.toBe(attempt.id);
    expect(
      await prisma.trainingEnrollment.count({ where: { trainingProgramId: program.id } }),
    ).toBe(2);
  });

  it("denies shelter writes server-side", async () => {
    const program = await createTrainingProgram("scope");
    const ctx = await contextFor(shelterUserId);
    await expect(
      service.createTrainingEnrollment(ctx, {
        programEnrollmentId: enrollmentId,
        trainingProgramId: program.id,
        enrolledAt: new Date("2026-07-01T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });

  it("rolls the participant journey from Training to Training complete without exposing attempt detail (AC4/AC5)", async () => {
    const participantCtx = await contextFor(participantUserId);
    expect(await service.getOwnTrainingJourney(participantCtx)).toMatchObject({
      stage: "TRAINING",
    });

    const coordinatorCtx = await contextFor(coordinatorId);
    const requiredPrograms = await prisma.trainingProgram.findMany({
      where: { programId, requiredForMatching: true, status: enums.ActiveStatus.ACTIVE },
      select: { id: true },
    });
    for (const program of requiredPrograms) {
      const attempts = await prisma.trainingEnrollment.findMany({
        where: { programEnrollmentId: enrollmentId, trainingProgramId: program.id },
      });
      if (
        attempts.some((attempt) => attempt.status === enums.TrainingEnrollmentStatus.COMPLETED)
      ) {
        continue;
      }
      const active = attempts.find(
        (attempt) =>
          attempt.status === enums.TrainingEnrollmentStatus.ENROLLED ||
          attempt.status === enums.TrainingEnrollmentStatus.IN_PROGRESS,
      );
      if (active) {
        await service.transitionTrainingEnrollment(coordinatorCtx, {
          trainingEnrollmentId: active.id,
          toStatus: enums.TrainingEnrollmentStatus.WITHDRAWN,
          effectiveDate: new Date("2026-07-12T00:00:00Z"),
        });
      }
      const replacement = await service.createTrainingEnrollment(coordinatorCtx, {
        programEnrollmentId: enrollmentId,
        trainingProgramId: program.id,
        enrolledAt: new Date("2026-07-12T00:00:00Z"),
      });
      await service.transitionTrainingEnrollment(coordinatorCtx, {
        trainingEnrollmentId: replacement.id,
        toStatus: enums.TrainingEnrollmentStatus.COMPLETED,
        effectiveDate: new Date("2026-07-12T00:00:00Z"),
        completionMethod: enums.TrainingCompletionMethod.PRIOR_LEARNING_VERIFICATION,
      });
    }

    expect(await service.getOwnTrainingJourney(participantCtx)).toEqual({
      stage: "TRAINING_COMPLETE",
      programName: "Transitional Employment Program",
      requiredCount: requiredPrograms.length,
      completedCount: requiredPrograms.length,
    });
  }, 20_000);
});

describe.skipIf(hasDatabase)("training enrollments (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
