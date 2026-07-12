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
  let programId: string;

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

    // Shared REAL reference row (Story 3.1) — upserted, never deleted here.
    const program = await prisma.program.upsert({
      where: { code: "NOVA-TE" },
      update: { status: enums.ActiveStatus.ACTIVE },
      create: {
        id: "program_nova_te",
        code: "NOVA-TE",
        name: "Transitional Employment Program",
      },
    });
    programId = program.id;
    // Required-task catalog (Story 3.2) — same reference rows the seed keeps.
    await prisma.onboardingTaskTemplate.upsert({
      where: { id: "nova_te_task_01" },
      update: { programId: program.id },
      create: {
        id: "nova_te_task_01",
        programId: program.id,
        title: "Attend orientation session",
        description: "Join the Project Nova orientation and meet your coordinator.",
        required: true,
        participantCompletable: false,
        sortOrder: 1,
      },
    });

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
    await prisma.onboardingTask.deleteMany({
      where: {
        enrollment: {
          participant: { person: { user: { email: { startsWith: `${runId}-` } } } },
        },
      },
    });
    await prisma.enrollmentEvent.deleteMany({
      where: {
        enrollment: {
          participant: { person: { user: { email: { startsWith: `${runId}-` } } } },
        },
      },
    });
    await prisma.programEnrollment.deleteMany({
      where: { participant: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.participant.deleteMany({
      where: { person: { user: { email: { startsWith: `${runId}-` } } } },
    });
    await prisma.backgroundReview.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.interview.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
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
    }, 30_000);

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

    it("schedules, reschedules with history, and advances after interview (Story 2.9)", async () => {
      const { userId, applicationId } = await createSubmittedApplicant("int-a");
      const ctx = await contextFor(coordinatorId);
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.INTERVIEW },
      });

      // Recording before scheduling is a lifecycle error.
      await expect(
        review.recordInterviewOutcome(
          ctx,
          applicationId,
          enums.InterviewOutcome.ADVANCE,
          "too early",
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      await review.scheduleInterview(
        ctx,
        applicationId,
        new Date("2026-08-01T10:30:00.000Z"),
        enums.InterviewFormat.IN_PERSON,
      );

      // The applicant sees date/time/format — and nothing else (AC1).
      const applicantCtx = await contextFor(userId);
      const appointment = await applications.getOwnUpcomingAppointment(
        applicantCtx,
        applicationId,
      );
      expect(appointment).toEqual({
        scheduledAtLabel: "August 1, 2026 at 10:30 AM",
        formatLabel: "In person",
      });

      // Rescheduling creates a NEW row; the prior time is preserved (AC2).
      await review.scheduleInterview(
        ctx,
        applicationId,
        new Date("2026-08-03T15:00:00.000Z"),
        enums.InterviewFormat.VIRTUAL,
      );
      const interviews = await review.listInterviews(ctx, applicationId);
      expect(interviews).toHaveLength(2);
      expect(interviews[0].isCurrent).toBe(true);
      expect(interviews[0].formatLabel).toBe("Virtual");
      expect(interviews[1].scheduledAtLabel).toBe("August 1, 2026 at 10:30 AM");

      // Advance moves to BACKGROUND_REVIEW with outcome and notes stored (AC3).
      await review.recordInterviewOutcome(
        ctx,
        applicationId,
        enums.InterviewOutcome.ADVANCE,
        "Internal recommendation: strong candidate.",
      );
      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.BACKGROUND_REVIEW);

      // Notes and the recommendation never reach the applicant (AC5); the
      // appointment card retires once the outcome is recorded.
      const views = await applications.getOwnApplications(applicantCtx);
      const payload = JSON.stringify({
        views,
        journeys: views.map((v) => journey.toJourneyView(v)),
      });
      expect(payload).not.toContain("strong candidate");
      expect(
        await applications.getOwnUpcomingAppointment(applicantCtx, applicationId),
      ).toBeNull();
    }, 30_000);

    it("routes Do Not Advance through the shared rejection in one transaction (Story 2.9)", async () => {
      const { applicationId } = await createSubmittedApplicant("int-b");
      const ctx = await contextFor(coordinatorId);
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.INTERVIEW },
      });
      await review.scheduleInterview(
        ctx,
        applicationId,
        new Date("2026-08-05T09:00:00.000Z"),
        enums.InterviewFormat.VIRTUAL,
      );

      await review.recordInterviewOutcome(
        ctx,
        applicationId,
        enums.InterviewOutcome.DO_NOT_ADVANCE,
        "Internal notes for the record.",
      );

      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.REJECTED);
      expect(row.decisionReason).toBe("INTERVIEW");

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "application.reject", subjectId: applicationId },
      });
      expect(audit.detail).toBe("INTERVIEW");

      // A second outcome can never be recorded (application left the phase).
      await expect(
        review.recordInterviewOutcome(
          ctx,
          applicationId,
          enums.InterviewOutcome.ADVANCE,
          "changed my mind",
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);
    });

    it("denies interview actions without the permissions or outside the phase (Story 2.9)", async () => {
      const { applicationId } = await createSubmittedApplicant("int-c");
      const ctx = await contextFor(coordinatorId);
      const shelterCtx = await contextFor(shelterUserId);

      // SUBMITTED — not the interview phase.
      await expect(
        review.scheduleInterview(
          ctx,
          applicationId,
          new Date("2026-08-01T10:00:00.000Z"),
          enums.InterviewFormat.IN_PERSON,
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.INTERVIEW },
      });
      await expect(
        review.scheduleInterview(
          shelterCtx,
          applicationId,
          new Date("2026-08-01T10:00:00.000Z"),
          enums.InterviewFormat.IN_PERSON,
        ),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
    });

    it("completes the FULL pipeline: Clear background decision unlocks Accept (Stories 2.10 + 2.11)", async () => {
      const { userId, applicationId } = await createSubmittedApplicant("bg-a");
      const coordinatorCtx = await contextFor(coordinatorId);
      const specialistCtx = await contextFor(specialistId);
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });

      // A coordinator can neither read nor record background detail (AC2).
      await expect(
        review.getBackgroundReview(coordinatorCtx, applicationId),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
      await expect(
        review.recordBackgroundDecision(
          coordinatorCtx,
          applicationId,
          enums.BackgroundOutcome.CLEAR,
          "should never save",
        ),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);

      // Before the decision, Accept correctly reports the missing prerequisite.
      await expect(
        review.acceptApplication(coordinatorCtx, applicationId),
      ).rejects.toMatchObject({
        code: "LIFECYCLE",
        message: expect.stringMatching(/background outcome/i),
      });

      // The specialist records Clear: row + distinct decide audit; the
      // application stays in BACKGROUND_REVIEW — never auto-accepted (AC3).
      await review.recordBackgroundDecision(
        specialistCtx,
        applicationId,
        enums.BackgroundOutcome.CLEAR,
        "External check complete; no job-related concerns (six factors documented).",
      );
      let row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.BACKGROUND_REVIEW);
      const decideAudit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "backgroundReview.decide", subjectId: applicationId },
      });
      expect(decideAudit.detail).toBe(enums.BackgroundOutcome.CLEAR);

      // Recording twice is a lifecycle error.
      await expect(
        review.recordBackgroundDecision(
          specialistCtx,
          applicationId,
          enums.BackgroundOutcome.CLEAR,
          "again",
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      expect(await review.acceptPrerequisiteFailures(applicationId)).toEqual([]);

      // The coordinator now accepts — the 2.11 transaction completes.
      await review.acceptApplication(coordinatorCtx, applicationId);
      row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.ACCEPTED);
      expect(row.decidedAt).toBeInstanceOf(Date);

      // Story 3.1: the SAME transaction created the participant and
      // enrollment, with the enrollment's lifecycle + audit events.
      const enrollment = await prisma.programEnrollment.findUniqueOrThrow({
        where: { applicationId },
      });
      expect(enrollment.status).toBe(enums.EnrollmentStatus.ONBOARDING);
      expect(enrollment.programId).toBe(programId);
      const participant = await prisma.participant.findUniqueOrThrow({
        where: { id: enrollment.participantId },
      });
      expect(participant.personId).toBe(row.personId);
      const enrollmentEvents = await prisma.enrollmentEvent.findMany({
        where: { enrollmentId: enrollment.id },
      });
      expect(enrollmentEvents).toHaveLength(1);
      expect(enrollmentEvents[0]).toMatchObject({
        fromStatus: null,
        toStatus: enums.EnrollmentStatus.ONBOARDING,
        actorUserId: coordinatorId,
      });
      await prisma.auditEvent.findFirstOrThrow({
        where: { action: "enrollment.create", subjectId: enrollment.id },
      });

      // Story 3.2: the SAME transaction generated the onboarding checklist —
      // one task per catalog template, Not Started, flags copied.
      const templates = await prisma.onboardingTaskTemplate.findMany({
        where: { programId },
      });
      const tasks = await prisma.onboardingTask.findMany({
        where: { enrollmentId: enrollment.id },
      });
      expect(tasks.length).toBe(templates.length);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        const template = templates.find((t) => t.id === task.templateId);
        expect(template).toBeDefined();
        expect(task.status).toBe(enums.OnboardingTaskStatus.NOT_STARTED);
        expect(task.required).toBe(template?.required);
        expect(task.participantCompletable).toBe(template?.participantCompletable);
        expect(task.placementId).toBeNull();
      }

      // Retried generation is a no-op (3.2 AC3).
      const enrollmentSvc = await import("@/server/services/enrollment-service");
      const regenerated = await prisma.$transaction((tx) =>
        enrollmentSvc.generateOnboardingTasksForEnrollment(tx, {
          id: enrollment.id,
          programId,
        }),
      );
      expect(regenerated).toBe(0);
      expect(
        await prisma.onboardingTask.count({ where: { enrollmentId: enrollment.id } }),
      ).toBe(tasks.length);

      // XOR ownership (3.2 AC4): the DATABASE rejects a task with both
      // owning contexts, and one with neither.
      await expect(
        prisma.onboardingTask.create({
          data: {
            enrollmentId: enrollment.id,
            placementId: "some_placement",
            title: "bad",
            description: "bad",
            required: true,
            participantCompletable: false,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.onboardingTask.create({
          data: {
            title: "bad",
            description: "bad",
            required: true,
            participantCompletable: false,
          },
        }),
      ).rejects.toThrow();

      // The restricted rationale reaches no other payload: not the
      // workspace, not the queue, not the participant journey (AC5).
      const workspace = await review.getApplicationWorkspace(coordinatorCtx, applicationId);
      const queue = await review.listApplicationsForOperations(coordinatorCtx);
      expect(JSON.stringify({ workspace, queue })).not.toContain("six factors documented");

      const applicantCtx = await contextFor(userId);
      const views = await applications.getOwnApplications(applicantCtx);
      const participantPayload = JSON.stringify({
        views,
        journeys: views.map((v) => journey.toJourneyView(v)),
      });
      expect(participantPayload).not.toContain("six factors documented");
      expect(participantPayload).not.toMatch(/backgroundReview|rationale/i);
    }, 30_000);

    it("routes a Disqualifying outcome by its ADR-016 category (Story 2.10)", async () => {
      const specialistCtx = await contextFor(specialistId);

      // Ordinary: BACKGROUND category -> REJECTED, reapplication possible.
      const ordinary = await createSubmittedApplicant("bg-b");
      await prisma.application.update({
        where: { id: ordinary.applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });
      await review.recordBackgroundDecision(
        specialistCtx,
        ordinary.applicationId,
        enums.BackgroundOutcome.DISQUALIFYING,
        "Job-related concern after individualized assessment.",
        "BACKGROUND",
      );
      const ordinaryRow = await prisma.application.findUniqueOrThrow({
        where: { id: ordinary.applicationId },
      });
      expect(ordinaryRow.status).toBe(enums.ApplicationStatus.REJECTED);
      expect(ordinaryRow.decisionReason).toBe("BACKGROUND");
      const ordinaryPerson = await prisma.person.findUniqueOrThrow({
        where: { id: ordinary.personId },
      });
      expect(ordinaryPerson.disqualifiedAt).toBeNull();

      // Permanent: the possession-ban category -> DISQUALIFIED + Person marker.
      const permanent = await createSubmittedApplicant("bg-c");
      await prisma.application.update({
        where: { id: permanent.applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });
      await review.recordBackgroundDecision(
        specialistCtx,
        permanent.applicationId,
        enums.BackgroundOutcome.DISQUALIFYING,
        "Active permanent possession ban verified via court record.",
        "PERMANENT_POSSESSION_BAN",
      );
      const permanentRow = await prisma.application.findUniqueOrThrow({
        where: { id: permanent.applicationId },
      });
      expect(permanentRow.status).toBe(enums.ApplicationStatus.DISQUALIFIED);
      const permanentPerson = await prisma.person.findUniqueOrThrow({
        where: { id: permanent.personId },
      });
      expect(permanentPerson.disqualifiedAt).toBeInstanceOf(Date);

      // A Disqualifying outcome without its category never records.
      const missing = await createSubmittedApplicant("bg-d");
      await prisma.application.update({
        where: { id: missing.applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });
      await expect(
        review.recordBackgroundDecision(
          specialistCtx,
          missing.applicationId,
          enums.BackgroundOutcome.DISQUALIFYING,
          "no category chosen",
        ),
      ).rejects.toBeInstanceOf(errors.ValidationError);
    }, 30_000);

    it("reuses the existing Participant for a returning person — one identity, two enrollments (3.1 AC3)", async () => {
      const coordinatorCtx = await contextFor(coordinatorId);
      const specialistCtx = await contextFor(specialistId);
      const { personId, applicationId } = await createSubmittedApplicant("enr-a");

      async function clearAndAccept(appId: string) {
        await prisma.application.update({
          where: { id: appId },
          data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
        });
        await review.recordBackgroundDecision(
          specialistCtx,
          appId,
          enums.BackgroundOutcome.CLEAR,
          "Synthetic clear.",
        );
        await review.acceptApplication(coordinatorCtx, appId);
      }

      await clearAndAccept(applicationId);

      // The alum applies again: a NEW application, the SAME participant.
      const second = await prisma.application.create({
        data: {
          personId,
          applicationNumber: applications.generateApplicationNumber(),
          status: enums.ApplicationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });
      await clearAndAccept(second.id);

      expect(await prisma.participant.count({ where: { personId } })).toBe(1);
      const participant = await prisma.participant.findUniqueOrThrow({
        where: { personId },
      });
      expect(
        await prisma.programEnrollment.count({ where: { participantId: participant.id } }),
      ).toBe(2);
    }, 30_000);

    it("rolls back the ENTIRE acceptance when enrollment creation fails (3.1 AC2)", async () => {
      const coordinatorCtx = await contextFor(coordinatorId);
      const specialistCtx = await contextFor(specialistId);
      const { personId, applicationId } = await createSubmittedApplicant("enr-b");
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: enums.ApplicationStatus.BACKGROUND_REVIEW },
      });
      await review.recordBackgroundDecision(
        specialistCtx,
        applicationId,
        enums.BackgroundOutcome.CLEAR,
        "Synthetic clear.",
      );

      // Sabotage: a pre-existing enrollment for this application makes the
      // in-transaction enrollment create violate the unique constraint.
      const participant = await prisma.participant.create({ data: { personId } });
      await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId,
          applicationId,
        },
      });

      await expect(review.acceptApplication(coordinatorCtx, applicationId)).rejects.toThrow();

      // Nothing committed: the application NEVER became accepted, no accept
      // events or audits exist, and no extra enrollment appeared.
      const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
      expect(row.status).toBe(enums.ApplicationStatus.BACKGROUND_REVIEW);
      expect(
        await prisma.applicationEvent.count({
          where: { applicationId, toStatus: enums.ApplicationStatus.ACCEPTED },
        }),
      ).toBe(0);
      expect(
        await prisma.auditEvent.count({
          where: { action: "application.accept", subjectId: applicationId },
        }),
      ).toBe(0);
      expect(
        await prisma.programEnrollment.count({ where: { applicationId } }),
      ).toBe(1); // only the sabotage row
    }, 30_000);

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
