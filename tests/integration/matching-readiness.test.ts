import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Matching readiness against Neon (Story 3.6): the policy reflects LIVE
 * database state across all three source tables — no stale cache — and the
 * participant view stays plain-language and ownership-scoped.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rdy36");

describe.skipIf(!hasDatabase)("matching readiness (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/readiness-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let coordinatorId: string;
  let participantUserId: string;
  let shelterUserId: string;
  let enrollmentId: string;
  let taskId: string;
  let trainingProgramId: string;
  let certificationId: string;

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
    service = await import("@/server/services/readiness-service");
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

    // A dedicated program with ONE required training keeps the matrix tight.
    const program = await prisma.program.create({
      data: {
        code: testScopedName(runId, "PRG"),
        name: testScopedName(runId, "Readiness Program"),
      },
    });
    const trainingProgram = await prisma.trainingProgram.create({
      data: {
        programId: program.id,
        code: `${runId}-TRN`,
        name: testScopedName(runId, "Core Training"),
        description: "Synthetic.",
        requiredForMatching: true,
      },
    });
    trainingProgramId = trainingProgram.id;

    const user = await prisma.user.create({
      data: {
        email: `${runId}-participant@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Ready",
            legalLastName: testScopedName(runId, "Person"),
            dateOfBirth: new Date("1990-05-05T00:00:00Z"),
          },
        },
      },
    });
    participantUserId = user.id;
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-RDY`,
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
    enrollmentId = enrollment.id;

    const task = await prisma.onboardingTask.create({
      data: {
        enrollmentId,
        title: testScopedName(runId, "Required task"),
        description: "Synthetic.",
        required: true,
        participantCompletable: true,
        sortOrder: 1,
      },
    });
    taskId = task.id;

    const certification = await prisma.certification.create({
      data: {
        participantId: participant.id,
        name: testScopedName(runId, "Required Cert"),
        issuer: "Synthetic Issuer",
        issuedOn: new Date("2024-01-01T00:00:00Z"),
        expiresOn: new Date("2025-01-01T00:00:00Z"), // already expired
        requiredForMatching: true,
      },
    });
    certificationId = certification.id;
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.certification.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.onboardingTask.deleteMany({ where: { enrollmentId } });
    await prisma.trainingEnrollmentEvent.deleteMany({
      where: { trainingEnrollment: { programEnrollmentId: enrollmentId } },
    });
    await prisma.trainingEnrollment.deleteMany({
      where: { programEnrollmentId: enrollmentId },
    });
    await prisma.enrollmentEvent.deleteMany({ where: { enrollmentId } });
    await prisma.programEnrollment.deleteMany({ where: { id: enrollmentId } });
    await prisma.trainingProgram.deleteMany({ where: { id: trainingProgramId } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
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

  it("reflects live state across all three tables — blockers shrink as each completes", async () => {
    const ctx = await contextFor(coordinatorId);

    let readiness = await service.getEnrollmentReadiness(ctx, enrollmentId);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((b) => b.kind).sort()).toEqual([
      "certification",
      "task",
      "training",
    ]);

    // Complete the task -> the task blocker disappears on the next read.
    await prisma.onboardingTask.update({
      where: { id: taskId },
      data: { status: enums.OnboardingTaskStatus.COMPLETE, completedAt: new Date() },
    });
    readiness = await service.getEnrollmentReadiness(ctx, enrollmentId);
    expect(readiness.blockers.map((b) => b.kind).sort()).toEqual([
      "certification",
      "training",
    ]);

    // Complete the training attempt -> only the expired certification remains.
    await prisma.trainingEnrollment.create({
      data: {
        programEnrollmentId: enrollmentId,
        trainingProgramId,
        status: enums.TrainingEnrollmentStatus.COMPLETED,
        enrolledAt: new Date("2026-07-01T00:00:00Z"),
        completedAt: new Date("2026-07-10T00:00:00Z"),
        completionMethod: enums.TrainingCompletionMethod.PROVIDER_VERIFICATION,
        completionVerifiedByUserId: coordinatorId,
        completionVerifiedAt: new Date(),
      },
    });
    readiness = await service.getEnrollmentReadiness(ctx, enrollmentId);
    expect(readiness.blockers.map((b) => b.kind)).toEqual(["certification"]);
    expect(readiness.blockers[0].detail).toBe("Required certification has expired");

    // Renew the certification -> ready, empty list (AC3).
    await prisma.certification.update({
      where: { id: certificationId },
      data: { expiresOn: new Date("2030-01-01T00:00:00Z") },
    });
    readiness = await service.getEnrollmentReadiness(ctx, enrollmentId);
    expect(readiness).toEqual({ ready: true, blockers: [] });
  });

  it("serves the participant a plain-language, ownership-scoped view (AC5)", async () => {
    const participantCtx = await contextFor(participantUserId);
    const own = await service.getOwnReadiness(participantCtx);
    expect(own?.ready).toBe(true);

    // Roll the certification back to expired: the participant sees a
    // respectful renewal line, no internal codes.
    await prisma.certification.update({
      where: { id: certificationId },
      data: { expiresOn: new Date("2025-01-01T00:00:00Z") },
    });
    const blocked = await service.getOwnReadiness(participantCtx);
    expect(blocked?.ready).toBe(false);
    expect(blocked?.items).toHaveLength(1);
    expect(blocked?.items[0].label).toMatch(/^Renew: .* \(it has expired\)$/);
    expect(JSON.stringify(blocked)).not.toMatch(/NOT_STARTED|EXPIRED|anchor/);
  });

  it("denies the coordinator view outside Nova scope", async () => {
    const shelterCtx = await contextFor(shelterUserId);
    await expect(
      service.getEnrollmentReadiness(shelterCtx, enrollmentId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });
});

describe.skipIf(hasDatabase)("matching readiness (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
