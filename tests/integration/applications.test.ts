import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Applications against Neon (Stories 2.3, 2.5): create/resume, the partial
 * unique index (one non-terminal per person), ownership scoping,
 * reapplication after REJECTED vs blocked after DISQUALIFIED,
 * optimistic-concurrency conflicts, and submission — completeness
 * enforcement, the transactional lifecycle event, and replay/stale-tab
 * rejection. Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("app23");

describe.skipIf(!hasDatabase)("applications (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/application-service");
  let journey: typeof import("@/server/services/application-journey");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let userAId: string;
  let userBId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { userId: user.id, email: user.email, displayName: user.displayName, memberships: [] };
  }

  async function createApplicant(tag: string) {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, `Applicant ${tag}`),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Test",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    return user.id;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/application-service");
    journey = await import("@/server/services/application-journey");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    userAId = await createApplicant("a");
    userBId = await createApplicant("b");
  });

  afterAll(async () => {
    // Children first — events and documents hang off applications.
    await prisma.applicationEvent.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.document.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email: { startsWith: `${runId}-` } } } },
    });
    await prisma.person.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.$disconnect();
  });

  it("creates a DRAFT with a human-facing number, then resumes it (no duplicates)", async () => {
    const ctx = await contextFor(userAId);

    const first = await service.startOrResumeApplication(ctx);
    expect(first.status).toBe(enums.ApplicationStatus.DRAFT);
    expect(first.applicationNumber).toMatch(/^APP-\d{4}-/);

    const resumed = await service.startOrResumeApplication(ctx);
    expect(resumed.id).toBe(first.id);

    const count = await prisma.application.count({
      where: { person: { userId: userAId } },
    });
    expect(count).toBe(1);
  });

  it("saves partial draft content leniently and refreshes the concurrency token", async () => {
    const ctx = await contextFor(userAId);
    const draft = await service.startOrResumeApplication(ctx);

    const saved = await service.saveDraft(
      ctx,
      draft.id,
      { motivation: "A fresh start.", availabilityNotes: "Weekday mornings" },
      draft.updatedAtToken,
    );
    expect(saved.motivation).toBe("A fresh start.");
    expect(saved.workExperience).toBeNull(); // partial is fine
    expect(saved.progressPercent).toBe(40);
    expect(saved.updatedAtToken).not.toBe(draft.updatedAtToken);
  });

  it("rejects a stale save with a Conflict (Concurrent update state)", async () => {
    const ctx = await contextFor(userAId);
    const draft = await service.startOrResumeApplication(ctx);
    const staleToken = draft.updatedAtToken;

    await service.saveDraft(ctx, draft.id, { motivation: "Tab one wins." }, staleToken);

    await expect(
      service.saveDraft(ctx, draft.id, { motivation: "Tab two loses." }, staleToken),
    ).rejects.toBeInstanceOf(errors.ConflictError);

    const row = await prisma.application.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.motivation).toBe("Tab one wins."); // nothing silently overwritten
  });

  it("never exposes another person's application (ownership -> plain 404)", async () => {
    const ctxA = await contextFor(userAId);
    const ctxB = await contextFor(userBId);
    const draftA = await service.startOrResumeApplication(ctxA);

    await expect(
      service.saveDraft(ctxB, draftA.id, { motivation: "intruder" }, draftA.updatedAtToken),
    ).rejects.toBeInstanceOf(errors.NotFoundError);

    const own = await service.getOwnApplications(ctxB);
    expect(own.find((a) => a.id === draftA.id)).toBeUndefined();
  });

  it("enforces one non-terminal application per person at the database layer", async () => {
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: userAId } });
    await expect(
      prisma.application.create({
        data: {
          personId: person.id,
          applicationNumber: service.generateApplicationNumber(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows reapplication after REJECTED once the 30-day window elapses (ADR-016)", async () => {
    const ctx = await contextFor(userBId);
    const first = await service.startOrResumeApplication(ctx);
    await prisma.application.update({
      where: { id: first.id },
      data: { status: enums.ApplicationStatus.REJECTED, decidedAt: new Date() },
    });

    // Inside the window: blocked with the reapply date, not an error page.
    await expect(service.startOrResumeApplication(ctx)).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringMatching(/on or after/),
    });

    // Window elapsed: a NEW record starts; the old one is preserved unchanged.
    await prisma.application.update({
      where: { id: first.id },
      data: { decidedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    const second = await service.startOrResumeApplication(ctx);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe(enums.ApplicationStatus.DRAFT);

    const old = await prisma.application.findUniqueOrThrow({ where: { id: first.id } });
    expect(old.status).toBe(enums.ApplicationStatus.REJECTED);
  });

  it("blocks a new application permanently after DISQUALIFIED, with respectful messaging", async () => {
    const ctx = await contextFor(userBId);
    const draft = await service.startOrResumeApplication(ctx);
    await prisma.application.update({
      where: { id: draft.id },
      data: { status: enums.ApplicationStatus.DISQUALIFIED, decidedAt: new Date() },
    });

    await expect(service.startOrResumeApplication(ctx)).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.not.stringMatching(/disqualif|reject|denied/i),
    });
  });

  describe("submission (Story 2.5)", () => {
    let userCId: string;

    const COMPLETE_ANSWERS = {
      motivation: "I want steady work and a team.",
      workExperience: "Warehouse and kitchen shifts.",
      animalExperience: "Grew up with dogs.",
      availabilityNotes: "Weekday mornings.",
      transportationNotes: "Bus line 7.",
    };

    /** Attach an ACTIVE required document directly — storage isn't under test here. */
    async function attachRequiredDocument(applicationId: string, uploaderId: string) {
      await prisma.document.create({
        data: {
          applicationId,
          documentType: enums.DocumentType.GOVERNMENT_ID,
          fileName: "id.png",
          contentType: "image/png",
          sizeBytes: 100,
          storagePathname: `${runId}-${applicationId}-id`,
          storageUrl: "https://example.invalid/id",
          uploadedByUserId: uploaderId,
        },
      });
    }

    beforeAll(async () => {
      userCId = await createApplicant("c");
    });

    it("blocks an incomplete draft with every missing item, and writes nothing", async () => {
      const ctx = await contextFor(userCId);
      const draft = await service.startOrResumeApplication(ctx);
      const saved = await service.saveDraft(
        ctx,
        draft.id,
        { motivation: "Only this one is filled in." },
        draft.updatedAtToken,
      );

      await expect(
        service.submitApplication(ctx, draft.id, saved.updatedAtToken),
      ).rejects.toMatchObject({ code: "VALIDATION" });

      const row = await prisma.application.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(enums.ApplicationStatus.DRAFT);
      expect(row.submittedAt).toBeNull();
      expect(await prisma.applicationEvent.count({ where: { applicationId: draft.id } })).toBe(0);
    });

    it("still blocks when answers are complete but the required document is missing", async () => {
      const ctx = await contextFor(userCId);
      const draft = await service.startOrResumeApplication(ctx);
      const saved = await service.saveDraft(ctx, draft.id, COMPLETE_ANSWERS, draft.updatedAtToken);

      await expect(
        service.submitApplication(ctx, draft.id, saved.updatedAtToken),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("never exposes another person's application to submit (ownership -> 404)", async () => {
      const ctxC = await contextFor(userCId);
      const ctxA = await contextFor(userAId);
      const draft = await service.startOrResumeApplication(ctxC);

      await expect(
        service.submitApplication(ctxA, draft.id, draft.updatedAtToken),
      ).rejects.toBeInstanceOf(errors.NotFoundError);
    });

    it("rejects a stale-tab submit as a Conflict — the atomic compare-and-set", async () => {
      const ctx = await contextFor(userCId);
      const draft = await service.startOrResumeApplication(ctx);
      await attachRequiredDocument(draft.id, userCId);
      const staleToken = draft.updatedAtToken;

      // Another tab saves after this tab loaded the page.
      await service.saveDraft(ctx, draft.id, COMPLETE_ANSWERS, staleToken);

      await expect(
        service.submitApplication(ctx, draft.id, staleToken),
      ).rejects.toBeInstanceOf(errors.ConflictError);

      const row = await prisma.application.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.status).toBe(enums.ApplicationStatus.DRAFT); // nothing half-submitted
      expect(await prisma.applicationEvent.count({ where: { applicationId: draft.id } })).toBe(0);
    });

    it("submits a complete draft: DRAFT -> SUBMITTED with its lifecycle event, atomically", async () => {
      const ctx = await contextFor(userCId);
      const fresh = await service.startOrResumeApplication(ctx);

      const submitted = await service.submitApplication(ctx, fresh.id, fresh.updatedAtToken);
      expect(submitted.status).toBe(enums.ApplicationStatus.SUBMITTED);
      expect(submitted.statusLabel).toBe("Submitted");

      const row = await prisma.application.findUniqueOrThrow({ where: { id: fresh.id } });
      expect(row.submittedAt).toBeInstanceOf(Date);

      const events = await prisma.applicationEvent.findMany({
        where: { applicationId: fresh.id },
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        fromStatus: enums.ApplicationStatus.DRAFT,
        toStatus: enums.ApplicationStatus.SUBMITTED,
        actorUserId: userCId,
      });
    });

    it("rejects a replayed submit as a lifecycle error — exactly one submission exists", async () => {
      const ctx = await contextFor(userCId);
      const apps = await service.getOwnApplications(ctx);
      const submitted = apps.find((a) => a.status === enums.ApplicationStatus.SUBMITTED);
      if (!submitted) throw new Error("expected a submitted application");

      await expect(
        service.submitApplication(ctx, submitted.id, submitted.updatedAtToken),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      expect(
        await prisma.applicationEvent.count({ where: { applicationId: submitted.id } }),
      ).toBe(1);
    });

    it("freezes the submitted form: a stale draft save is rejected, content untouched", async () => {
      const ctx = await contextFor(userCId);
      const apps = await service.getOwnApplications(ctx);
      const submitted = apps.find((a) => a.status === enums.ApplicationStatus.SUBMITTED);
      if (!submitted) throw new Error("expected a submitted application");

      await expect(
        service.saveDraft(
          ctx,
          submitted.id,
          { motivation: "Editing after the fact" },
          submitted.updatedAtToken,
        ),
      ).rejects.toBeInstanceOf(errors.LifecycleError);

      const row = await prisma.application.findUniqueOrThrow({ where: { id: submitted.id } });
      expect(row.motivation).toBe(COMPLETE_ANSWERS.motivation);
    });
  });

  describe("journey view (Story 2.6)", () => {
    it("structurally excludes internal decision detail from the participant payload", async () => {
      // Operations records an internal rationale on userB's disqualified
      // application — the kind of Highly Restricted detail (2.11) that must
      // never reach a participant-facing response.
      await prisma.application.updateMany({
        where: {
          person: { userId: userBId },
          status: enums.ApplicationStatus.DISQUALIFIED,
        },
        data: { decisionReason: "Internal screening rationale" },
      });

      const ctx = await contextFor(userBId);
      const views = await service.getOwnApplications(ctx);
      expect(views.length).toBeGreaterThan(0);

      // The applicant's own views carry form content but never decision detail.
      const viewPayload = JSON.stringify(views);
      expect(viewPayload).not.toContain("decisionReason");
      expect(viewPayload).not.toContain("rationale");

      // The journey is stricter still: status-shaped only — no internal
      // phase names, no raw terminal enum values, no form content.
      const journeyPayload = JSON.stringify(views.map((v) => journey.toJourneyView(v)));
      expect(journeyPayload).not.toMatch(/rationale|decisionReason/i);
      expect(journeyPayload).not.toMatch(/ELIGIBILITY|INTERVIEW|BACKGROUND|DISQUALIF/i);
    });
  });
});

describe.skipIf(hasDatabase)("applications (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
