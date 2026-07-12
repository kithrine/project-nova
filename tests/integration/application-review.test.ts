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
    await prisma.eligibilityReview.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
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
    // Eligibility (2.8) is a live panel now — no disabled stub for SUBMITTED.
    expect(workspace.actions).toEqual([]);

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

  describe("terminal decisions (Story 2.11, ADR-016)", () => {
    async function createSubmittedApplicant(tag: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Decision",
              legalLastName: testScopedName(runId, tag),
              dateOfBirth: new Date("1994-07-07T00:00:00Z"),
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
          applicationNumber: applications.generateApplicationNumber(),
          status: enums.ApplicationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });
      return { userId: user.id, personId: person.id, applicationId: application.id };
    }

    it("rejects ordinarily in one transaction: status, event, audit category — no Person marker", async () => {
      const { userId, personId, applicationId } = await createSubmittedApplicant("d");
      const ctx = await contextFor(coordinatorId);

      await review.rejectApplication(ctx, applicationId, "INTERVIEW");

      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.REJECTED);
      expect(row.decidedAt).toBeInstanceOf(Date);
      expect(row.decisionReason).toBe("INTERVIEW");

      const events = await prisma.applicationEvent.findMany({ where: { applicationId } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        fromStatus: enums.ApplicationStatus.SUBMITTED,
        toStatus: enums.ApplicationStatus.REJECTED,
        actorUserId: coordinatorId,
      });

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "application.reject", subjectId: applicationId },
      });
      expect(audit.detail).toBe("INTERVIEW");

      const person = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
      expect(person.disqualifiedAt).toBeNull();

      // The 30-day window: blocked with the reapply date, never an error page.
      const applicantCtx = await contextFor(userId);
      await expect(applications.startOrResumeApplication(applicantCtx)).rejects.toMatchObject({
        code: "LIFECYCLE",
        message: expect.stringMatching(/on or after/),
      });

      // After the window elapses, a fresh application starts normally.
      await prisma.application.update({
        where: { id: applicationId },
        data: { decidedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });
      const fresh = await applications.startOrResumeApplication(applicantCtx);
      expect(fresh.status).toBe(enums.ApplicationStatus.DRAFT);
      expect(fresh.id).not.toBe(applicationId);
    });

    it("disqualifies ONLY via an ADR-016 category: Person marker set, future applications blocked", async () => {
      const { userId, personId, applicationId } = await createSubmittedApplicant("e");
      const ctx = await contextFor(coordinatorId);

      await review.rejectApplication(ctx, applicationId, "PROGRAM_FRAUD");

      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.DISQUALIFIED);

      const person = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
      expect(person.disqualifiedAt).toBeInstanceOf(Date);

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "application.reject", subjectId: applicationId },
      });
      expect(audit.detail).toBe("PROGRAM_FRAUD");

      // Creation-time block with respectful messaging (2.3 AC4).
      const applicantCtx = await contextFor(userId);
      await expect(applications.startOrResumeApplication(applicantCtx)).rejects.toMatchObject({
        code: "LIFECYCLE",
        message: expect.not.stringMatching(/disqualif|reject|denied/i),
      });
    });

    it("never reopens a terminal application (AC5)", async () => {
      const { applicationId } = await createSubmittedApplicant("f");
      const ctx = await contextFor(coordinatorId);

      await review.rejectApplication(ctx, applicationId, "OTHER");
      await expect(
        review.rejectApplication(ctx, applicationId, "OTHER"),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      expect(
        await prisma.applicationEvent.count({ where: { applicationId } }),
      ).toBe(1); // exactly one decision ever recorded
    });

    it("guards accept: wrong lifecycle is a lifecycle error; BACKGROUND_REVIEW awaits 2.10's Clear outcome", async () => {
      const { applicationId } = await createSubmittedApplicant("g");
      const ctx = await contextFor(coordinatorId);

      // SUBMITTED: lifecycle guard fires before anything else.
      await expect(review.acceptApplication(ctx, applicationId)).rejects.toBeInstanceOf(
        errors.LifecycleError,
      );

      // BACKGROUND_REVIEW: the business prerequisite (Clear outcome, 2.10)
      // correctly reports as unmet — no BackgroundReview model exists yet.
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });
      await expect(review.acceptApplication(ctx, applicationId)).rejects.toMatchObject({
        code: "LIFECYCLE",
        message: expect.stringMatching(/background outcome/i),
      });

      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.BACKGROUND_REVIEW); // untouched
      expect(await prisma.applicationEvent.count({ where: { applicationId } })).toBe(0);
    });

    it("denies decisions to users without the permissions (never shelters)", async () => {
      const { applicationId } = await createSubmittedApplicant("h");
      const shelterCtx = await contextFor(shelterUserId);

      await expect(
        review.rejectApplication(shelterCtx, applicationId, "OTHER"),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
      await expect(review.acceptApplication(shelterCtx, applicationId)).rejects.toBeInstanceOf(
        errors.AuthorizationError,
      );
    });

    it("runs eligibility end to end: begin, Eligible advances, rationale stays internal (Story 2.8)", async () => {
      const { userId, applicationId } = await createSubmittedApplicant("elig-a");
      const ctx = await contextFor(coordinatorId);

      await review.beginEligibilityReview(ctx, applicationId);
      let row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.ELIGIBILITY_REVIEW);

      const started = await review.getEligibilityReview(ctx, applicationId);
      expect(started?.outcome).toBeNull();

      // Beginning twice is a lifecycle error — the review exists exactly once.
      await expect(review.beginEligibilityReview(ctx, applicationId)).rejects.toBeInstanceOf(
        errors.LifecycleError,
      );

      await review.recordEligibilityOutcome(
        ctx,
        applicationId,
        enums.EligibilityOutcome.ELIGIBLE,
        "Meets every ADR-015 rubric item.",
      );
      row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.INTERVIEW);

      const events = await prisma.applicationEvent.findMany({
        where: { applicationId },
        orderBy: { createdAt: "asc" },
      });
      expect(events.map((e) => e.toStatus)).toEqual([
        enums.ApplicationStatus.ELIGIBILITY_REVIEW,
        enums.ApplicationStatus.INTERVIEW,
      ]);

      // A second outcome can never be recorded.
      await expect(
        review.recordEligibilityOutcome(
          ctx,
          applicationId,
          enums.EligibilityOutcome.NOT_ELIGIBLE,
          "changed my mind",
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      // The rationale never reaches the applicant's payload (AC5).
      const applicantCtx = await contextFor(userId);
      const views = await applications.getOwnApplications(applicantCtx);
      const payload = JSON.stringify({
        views,
        journeys: views.map((v) => journey.toJourneyView(v)),
      });
      expect(payload).not.toContain("rubric item");
      expect(payload).not.toContain("rationale");
    });

    it("routes Not Eligible through the shared rejection in one transaction (Story 2.8)", async () => {
      const { applicationId } = await createSubmittedApplicant("elig-b");
      const ctx = await contextFor(coordinatorId);

      await review.beginEligibilityReview(ctx, applicationId);
      await review.recordEligibilityOutcome(
        ctx,
        applicationId,
        enums.EligibilityOutcome.NOT_ELIGIBLE,
        "Outside the program window (ADR-015 rubric).",
      );

      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.REJECTED); // ordinary — never DQ
      expect(row.decisionReason).toBe("ELIGIBILITY");

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "application.reject", subjectId: applicationId },
      });
      expect(audit.detail).toBe("ELIGIBILITY");

      const reviewRow = await prisma.eligibilityReview.findUniqueOrThrow({
        where: { applicationId },
      });
      expect(reviewRow.outcome).toBe(enums.EligibilityOutcome.NOT_ELIGIBLE);
    });

    it("denies eligibility actions without the permission or on the wrong lifecycle (Story 2.8)", async () => {
      const { applicationId } = await createSubmittedApplicant("elig-c");
      const shelterCtx = await contextFor(shelterUserId);
      const specialistCtx = await contextFor(specialistId);
      const coordinatorCtx = await contextFor(coordinatorId);

      await expect(
        review.beginEligibilityReview(shelterCtx, applicationId),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
      // RRS holds application.view but NOT eligibilityReview.decide.
      await expect(
        review.beginEligibilityReview(specialistCtx, applicationId),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
      // Recording before beginning is a lifecycle error.
      await expect(
        review.recordEligibilityOutcome(
          coordinatorCtx,
          applicationId,
          enums.EligibilityOutcome.ELIGIBLE,
          "too early",
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);
    });

    it("keeps the decision category out of the participant payload", async () => {
      const { userId, applicationId } = await createSubmittedApplicant("i");
      const ctx = await contextFor(coordinatorId);
      await review.rejectApplication(ctx, applicationId, "BACKGROUND");

      const applicantCtx = await contextFor(userId);
      const views = await applications.getOwnApplications(applicantCtx);
      const payload = JSON.stringify({
        views,
        journeys: views.map((v) => journey.toJourneyView(v)),
      });
      expect(payload).not.toContain("decisionReason");
      expect(payload).not.toContain("BACKGROUND"); // the category never leaks
      // The journey still tells the applicant when they may reapply.
      expect(payload).toMatch(/apply again on or after/i);
    });
  });
});

describe.skipIf(hasDatabase)("application review (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
