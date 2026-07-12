import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Application drafts against Neon (Story 2.3): create/resume, the partial
 * unique index (one non-terminal per person), ownership scoping,
 * reapplication after REJECTED vs blocked after DISQUALIFIED, and
 * optimistic-concurrency conflicts. Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("app23");

describe.skipIf(!hasDatabase)("applications (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/application-service");
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
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    userAId = await createApplicant("a");
    userBId = await createApplicant("b");
  });

  afterAll(async () => {
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

  it("allows reapplication after REJECTED — new record, old preserved unchanged", async () => {
    const ctx = await contextFor(userBId);
    const first = await service.startOrResumeApplication(ctx);
    await prisma.application.update({
      where: { id: first.id },
      data: { status: enums.ApplicationStatus.REJECTED, decidedAt: new Date() },
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
});

describe.skipIf(hasDatabase)("applications (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
