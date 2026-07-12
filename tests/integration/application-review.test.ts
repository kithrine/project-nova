import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Operations review surface against Neon (Story 2.7): Nova scope
 * enforcement, draft invisibility, restricted background access with its
 * audit trail, and case notes that never reach participant payloads.
 * Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rev27");

describe.skipIf(!hasDatabase)("application review (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let review: typeof import("@/server/services/application-review-service");
  let applications: typeof import("@/server/services/application-service");
  let journey: typeof import("@/server/services/application-journey");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let coordinatorId: string;
  let specialistId: string;
  let shelterUserId: string;
  let applicantUserId: string;
  let submittedAppId: string;
  let draftAppId: string;

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
    review = await import("@/server/services/application-review-service");
    applications = await import("@/server/services/application-service");
    journey = await import("@/server/services/application-journey");
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
    const specialist = await prisma.user.create({
      data: {
        email: `${runId}-rrs@synthetic.example`,
        displayName: testScopedName(runId, "Specialist"),
        isSynthetic: true,
        memberships: {
          create: {
            organizationId: nova.id,
            role: enums.Role.RESTRICTED_REVIEW_SPECIALIST,
          },
        },
      },
    });
    const shelterUser = await prisma.user.create({
      data: {
        email: `${runId}-shelter@synthetic.example`,
        displayName: testScopedName(runId, "Shelter Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: shelter.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });

    const applicant = await prisma.user.create({
      data: {
        email: `${runId}-applicant@synthetic.example`,
        displayName: testScopedName(runId, "Applicant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Review",
            legalLastName: testScopedName(runId, "Applicant"),
            dateOfBirth: new Date("1992-05-05T00:00:00Z"),
          },
        },
      },
    });
    const drafter = await prisma.user.create({
      data: {
        email: `${runId}-drafter@synthetic.example`,
        displayName: testScopedName(runId, "Drafter"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Draft",
            legalLastName: testScopedName(runId, "Only"),
            dateOfBirth: new Date("1993-06-06T00:00:00Z"),
          },
        },
      },
    });

    coordinatorId = coordinator.id;
    specialistId = specialist.id;
    shelterUserId = shelterUser.id;
    applicantUserId = applicant.id;

    const applicantPerson = await prisma.person.findUniqueOrThrow({
      where: { userId: applicant.id },
    });
    const drafterPerson = await prisma.person.findUniqueOrThrow({
      where: { userId: drafter.id },
    });

    const submitted = await prisma.application.create({
      data: {
        personId: applicantPerson.id,
        applicationNumber: applications.generateApplicationNumber(),
        status: enums.ApplicationStatus.SUBMITTED,
        submittedAt: new Date("2026-07-01T00:00:00Z"),
        motivation: "Steady work.",
      },
    });
    const draft = await prisma.application.create({
      data: {
        personId: drafterPerson.id,
        applicationNumber: applications.generateApplicationNumber(),
      },
    });
    submittedAppId = submitted.id;
    draftAppId = draft.id;
  });

  afterAll(async () => {
    const runUsers = await prisma.user.findMany({
      where: { email: { startsWith: `${runId}-` } },
      select: { id: true },
    });
    const userIds = runUsers.map((u) => u.id);
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.caseNote.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.applicationEvent.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email: { startsWith: `${runId}-` } } } },
    });
    await prisma.person.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("shows a coordinator the queue with submitted work — but never drafts (AC1)", async () => {
    const ctx = await contextFor(coordinatorId);
    const queue = await review.listApplicationsForOperations(ctx);

    expect(queue.find((e) => e.id === submittedAppId)).toBeDefined();
    expect(queue.find((e) => e.id === draftAppId)).toBeUndefined();
  });

  it("denies the queue to users without Nova scope — no application data (AC5)", async () => {
    const ctx = await contextFor(shelterUserId);
    await expect(review.listApplicationsForOperations(ctx)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
    await expect(
      review.getApplicationWorkspace(ctx, submittedAppId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });

  it("serves the workspace to a coordinator, and treats drafts as plain 404s", async () => {
    const ctx = await contextFor(coordinatorId);
    const workspace = await review.getApplicationWorkspace(ctx, submittedAppId);

    expect(workspace.statusLabel).toBe("Submitted");
    expect(workspace.answers.find((a) => a.value === "Steady work.")).toBeDefined();
    expect(workspace.actions.map((a) => a.label)).toEqual(["Begin Eligibility Review"]);

    await expect(review.getApplicationWorkspace(ctx, draftAppId)).rejects.toBeInstanceOf(
      errors.NotFoundError,
    );
  });

  it("keeps background content unauthorized for a coordinator — and writes NO audit event (AC3)", async () => {
    const ctx = await contextFor(coordinatorId);
    const access = await review.openBackgroundTab(ctx, submittedAppId);

    expect(access.authorized).toBe(false);
    const audits = await prisma.auditEvent.count({
      where: { actorUserId: coordinatorId },
    });
    expect(audits).toBe(0);
  });

  it("authorizes the specialist and writes the audit event in the same request (AC4)", async () => {
    const ctx = await contextFor(specialistId);
    const access = await review.openBackgroundTab(ctx, submittedAppId);

    expect(access.authorized).toBe(true);
    const audits = await prisma.auditEvent.findMany({
      where: { actorUserId: specialistId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "backgroundReview.view",
      subjectType: "Application",
      subjectId: submittedAppId,
    });
  });

  it("stores internal notes visible to Operations — and never in participant payloads (AC6)", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);
    await review.addCaseNote(
      coordinatorCtx,
      submittedAppId,
      "Internal note: waiting on interview availability.",
    );

    const notes = await review.listCaseNotes(coordinatorCtx, submittedAppId);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("waiting on interview availability");

    // The applicant's own views and journey carry no trace of the note.
    const applicantCtx = await contextFor(applicantUserId);
    const own = await applications.getOwnApplications(applicantCtx);
    const participantPayload = JSON.stringify({
      views: own,
      journeys: own.map((v) => journey.toJourneyView(v)),
    });
    expect(participantPayload).not.toContain("waiting on interview availability");
    expect(participantPayload).not.toContain("caseNote");
  });

  it("rejects an empty note and enforces the note permission", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(
      review.addCaseNote(coordinatorCtx, submittedAppId, "   "),
    ).rejects.toBeInstanceOf(errors.ValidationError);

    const shelterCtx = await contextFor(shelterUserId);
    await expect(
      review.addCaseNote(shelterCtx, submittedAppId, "should never save"),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });
});

describe.skipIf(hasDatabase)("application review (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
