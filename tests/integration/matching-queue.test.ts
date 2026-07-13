import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Matching queue against Neon (Story 4.1): inclusion/exclusion across
 * ready, already-matched, and not-yet-ready participants; host capacity
 * filtering; the one-non-terminal-match partial unique index; and
 * permission enforcement. Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("mtq41");

describe.skipIf(!hasDatabase)("matching queue (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/matching-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let coordinatorId: string;
  let shelterUserId: string;
  let hostOrgId: string;
  let siteId: string;
  let emptySiteOrgId: string;
  let programId: string;
  let readyEnrollmentId: string;
  let matchedEnrollmentId: string;
  let matchedParticipantId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function createReadyParticipant(tag: string, status: "ONBOARDING" | "READY_FOR_MATCHING") {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, tag),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Queue",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1990-06-06T00:00:00Z"),
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
        availabilityNotes: "Weekday mornings",
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const enrollment = await prisma.programEnrollment.create({
      data: {
        participantId: participant.id,
        programId,
        applicationId: application.id,
        status: enums.EnrollmentStatus[status],
      },
    });
    if (status === "READY_FOR_MATCHING") {
      await prisma.enrollmentEvent.create({
        data: {
          enrollmentId: enrollment.id,
          fromStatus: enums.EnrollmentStatus.ONBOARDING,
          toStatus: enums.EnrollmentStatus.READY_FOR_MATCHING,
          actorUserId: user.id,
        },
      });
    }
    return { participantId: participant.id, enrollmentId: enrollment.id };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/matching-service");
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
    const host = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Host Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            { name: testScopedName(runId, "Main Site"), capacity: 2 },
            { name: testScopedName(runId, "Full Site"), capacity: 0 },
          ],
        },
      },
      include: { sites: true },
    });
    hostOrgId = host.id;
    siteId = host.sites.find((s) => s.capacity > 0)!.id;
    const emptyHost = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "No Capacity Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: { create: [{ name: testScopedName(runId, "Zero Site"), capacity: 0 }] },
      },
    });
    emptySiteOrgId = emptyHost.id;

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
    const shelterUser = await prisma.user.create({
      data: {
        email: `${runId}-shelter@synthetic.example`,
        displayName: testScopedName(runId, "Shelter User"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    shelterUserId = shelterUser.id;

    const program = await prisma.program.create({
      data: {
        code: testScopedName(runId, "PRG"),
        name: testScopedName(runId, "Queue Program"),
      },
    });
    programId = program.id;

    const ready = await createReadyParticipant("ready", "READY_FOR_MATCHING");
    readyEnrollmentId = ready.enrollmentId;
    const matched = await createReadyParticipant("matched", "READY_FOR_MATCHING");
    matchedEnrollmentId = matched.enrollmentId;
    matchedParticipantId = matched.participantId;
    await createReadyParticipant("onboarding", "ONBOARDING");

    await prisma.placementMatch.create({
      data: {
        participantId: matched.participantId,
        programEnrollmentId: matched.enrollmentId,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        status: enums.MatchStatus.DRAFT,
      },
    });
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
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
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 30_000);

  it("classifies ready, matched, and not-ready participants correctly (AC1/AC2)", async () => {
    const ctx = await contextFor(coordinatorId);
    const queue = await service.getMatchingQueue(ctx);

    const ready = queue.candidates.find((c) => c.enrollmentId === readyEnrollmentId);
    expect(ready).toMatchObject({
      state: "AWAITING_MATCH",
      availability: "Weekday mornings",
    });
    expect(ready?.readySinceLabel).toBeTruthy();

    const matched = queue.candidates.find((c) => c.enrollmentId === matchedEnrollmentId);
    expect(matched?.state).toBe("MATCH_IN_PROGRESS");
    // Exactly once — never duplicated as awaiting.
    expect(
      queue.candidates.filter((c) => c.enrollmentId === matchedEnrollmentId),
    ).toHaveLength(1);

    // The ONBOARDING enrollment never appears.
    const names = queue.candidates.map((c) => c.participantName).join(" ");
    expect(names).not.toContain("onboarding");
  });

  it("lists only hosts with sites that have capacity (AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const queue = await service.getMatchingQueue(ctx);

    const host = queue.hosts.find((h) => h.organizationId === hostOrgId);
    expect(host).toBeDefined();
    expect(host?.sites.map((s) => s.capacity)).toEqual([2]); // zero-capacity site filtered
    expect(queue.hosts.find((h) => h.organizationId === emptySiteOrgId)).toBeUndefined();
  });

  it("enforces one non-terminal match per participant at the database layer", async () => {
    await expect(
      prisma.placementMatch.create({
        data: {
          participantId: matchedParticipantId,
          programEnrollmentId: matchedEnrollmentId,
          hostOrganizationId: hostOrgId,
          organizationSiteId: siteId,
          status: enums.MatchStatus.PROPOSED,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("denies the queue outside Nova scope or without the permission (AC6)", async () => {
    const shelterCtx = await contextFor(shelterUserId);
    await expect(service.getMatchingQueue(shelterCtx)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });

  it("evaluates live pairing compatibility with explainable factors (Story 4.2)", async () => {
    const ctx = await contextFor(coordinatorId);

    // The host has a MANAGER but no SUPERVISOR membership yet: supervision
    // blocks, and the read names it.
    let evaluation = await service.evaluatePairingCompatibility(
      ctx,
      readyEnrollmentId,
      siteId,
    );
    expect(evaluation.result.category).toBe("BLOCKING_INCOMPATIBILITY");
    expect(
      evaluation.result.factors.find((f) => f.key === "supervision"),
    ).toMatchObject({
      status: "BLOCKING",
      detail: "No active supervisors at this shelter — daily supervision is required.",
    });
    expect(
      evaluation.result.factors.find((f) => f.key === "availability")?.detail,
    ).toContain("Weekday mornings");

    // Add a supervisor: the same inputs now produce Unknown / needs review
    // (transportation, schedule, and dates are honestly undetermined at the
    // pairing stage) — never a guessed Compatible (AC4).
    await prisma.user.create({
      data: {
        email: `${runId}-supervisor@synthetic.example`,
        displayName: testScopedName(runId, "Supervisor"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: hostOrgId, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    evaluation = await service.evaluatePairingCompatibility(ctx, readyEnrollmentId, siteId);
    expect(evaluation.result.category).toBe("UNKNOWN_NEEDS_REVIEW");
    expect(
      evaluation.result.factors
        .filter((f) => f.status === "UNKNOWN")
        .map((f) => f.key)
        .sort(),
    ).toEqual(["dates", "schedule", "transportation"]);

    // No numeric score exists anywhere in the payload (ADR-011).
    expect(JSON.stringify(evaluation.result)).not.toMatch(/score|\b\d{1,3}%/i);
  });

  it("denies the compatibility read to shelter users (Story 4.2)", async () => {
    const shelterCtx = await contextFor(shelterUserId);
    await expect(
      service.evaluatePairingCompatibility(shelterCtx, readyEnrollmentId, siteId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });
});

describe.skipIf(hasDatabase)("matching queue (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
