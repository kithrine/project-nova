import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Match drafts against Neon (Story 4.3): transactional creation with the
 * lifecycle event and snapshot, prerequisite blocking with plain-language
 * reasons, the partial unique index, draft editing with snapshot
 * re-evaluation, withdrawal, and coordinator-only visibility.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pmd43");

describe.skipIf(!hasDatabase)("placement match drafts (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/matching-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let coordinatorId: string;
  let shelterUserId: string;
  let participantUserId: string;
  let enrollmentId: string;
  let onboardingEnrollmentId: string;
  let siteId: string;
  let secondSiteId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function createParticipant(tag: string, status: "ONBOARDING" | "READY_FOR_MATCHING") {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, tag),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Match",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1991-01-01T00:00:00Z"),
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
        transportationNotes: "Bus line 7",
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const program = await prisma.program.upsert({
      where: { code: `${runId}-PRG` },
      update: {},
      create: { code: `${runId}-PRG`, name: testScopedName(runId, "Match Program") },
    });
    const enrollment = await prisma.programEnrollment.create({
      data: {
        participantId: participant.id,
        programId: program.id,
        applicationId: application.id,
        status: enums.EnrollmentStatus[status],
      },
    });
    return { userId: user.id, enrollmentId: enrollment.id };
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
            { name: testScopedName(runId, "North Site"), capacity: 1 },
          ],
        },
      },
      include: { sites: { orderBy: { name: "asc" } } },
    });
    siteId = host.sites[0].id;
    secondSiteId = host.sites[1].id;

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
        displayName: testScopedName(runId, "Shelter Supervisor"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    shelterUserId = shelterUser.id;

    const ready = await createParticipant("ready", "READY_FOR_MATCHING");
    enrollmentId = ready.enrollmentId;
    participantUserId = ready.userId;
    const onboarding = await createParticipant("onboard", "ONBOARDING");
    onboardingEnrollmentId = onboarding.enrollmentId;
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placementMatchEvent.deleteMany({
      where: {
        placementMatch: { participant: { person: { user: { email: emails } } } },
      },
    });
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

  it("creates a Draft transactionally: row + creation event + audit + snapshot (AC1)", async () => {
    const ctx = await contextFor(coordinatorId);
    const created = await service.createMatchDraft(ctx, { enrollmentId, siteId });

    const row = await prisma.placementMatch.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe(enums.MatchStatus.DRAFT);
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.PENDING);
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.PENDING);

    const snapshot = service.parseCompatibilitySnapshot(row.compatibilitySnapshot);
    expect(snapshot?.category).toBeTruthy();
    expect(snapshot?.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const events = await prisma.placementMatchEvent.findMany({
      where: { placementMatchId: created.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: enums.MatchStatus.DRAFT });

    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "placementMatch.create", subjectId: created.id },
    });
  });

  it("blocks a second draft with the one-match reason, and the index backstops it (AC2)", async () => {
    const ctx = await contextFor(coordinatorId);
    await expect(
      service.createMatchDraft(ctx, { enrollmentId, siteId: secondSiteId }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("one-placement-at-a-time"),
    });

    // Direct insert bypassing the service: Postgres rejects it too.
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId },
    });
    await expect(
      prisma.placementMatch.create({
        data: {
          participantId: match.participantId,
          programEnrollmentId: enrollmentId,
          hostOrganizationId: match.hostOrganizationId,
          organizationSiteId: secondSiteId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects creation for a not-ready enrollment with the readiness reason", async () => {
    const ctx = await contextFor(coordinatorId);
    await expect(
      service.createMatchDraft(ctx, { enrollmentId: onboardingEnrollmentId, siteId }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/ready for matching/i),
    });
  });

  it("edits a draft and re-evaluates the snapshot against the new details (AC3/AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId },
    });

    await service.updateMatchDraft(ctx, match.id, {
      siteId: secondSiteId,
      supervisorId: shelterUserId,
      schedule: "Mon/Wed mornings",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-12-01T00:00:00.000Z"),
      fundingSourceId: null,
      notes: "Internal pairing rationale.",
    });

    const updated = await prisma.placementMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(updated.status).toBe(enums.MatchStatus.DRAFT);
    expect(updated.organizationSiteId).toBe(secondSiteId);
    expect(updated.proposedSchedule).toBe("Mon/Wed mornings");

    const snapshot = service.parseCompatibilitySnapshot(updated.compatibilitySnapshot);
    const scheduleFactor = snapshot?.factors.find((f) => f.key === "schedule");
    expect(scheduleFactor).toMatchObject({
      status: "CLEAR",
      detail: "Proposed: Mon/Wed mornings",
    });

    // End before start is rejected.
    await expect(
      service.updateMatchDraft(ctx, match.id, {
        siteId: secondSiteId,
        supervisorId: null,
        schedule: null,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-08-01T00:00:00.000Z"),
        fundingSourceId: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(errors.ValidationError);
  });

  it("keeps drafts coordinator-only: participant and shelter access is denied (AC6)", async () => {
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId },
    });
    const participantCtx = await contextFor(participantUserId);
    const shelterCtx = await contextFor(shelterUserId);

    for (const ctx of [participantCtx, shelterCtx]) {
      await expect(service.getMatchWorkspace(ctx, match.id)).rejects.toBeInstanceOf(
        errors.AuthorizationError,
      );
      await expect(
        service.createMatchDraft(ctx, { enrollmentId, siteId }),
      ).rejects.toBeInstanceOf(errors.AuthorizationError);
    }
  });

  it("withdraws a draft to terminal, with event and audit; terminal edits refuse (AC5)", async () => {
    const ctx = await contextFor(coordinatorId);
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId },
    });

    await service.withdrawMatchDraft(ctx, match.id);
    const row = await prisma.placementMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(row.status).toBe(enums.MatchStatus.WITHDRAWN);

    const events = await prisma.placementMatchEvent.findMany({
      where: { placementMatchId: match.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.toStatus)).toEqual([
      enums.MatchStatus.DRAFT,
      enums.MatchStatus.WITHDRAWN,
    ]);
    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "placementMatch.withdraw", subjectId: match.id },
    });

    await expect(
      service.updateMatchDraft(ctx, match.id, {
        siteId,
        supervisorId: null,
        schedule: null,
        startDate: null,
        endDate: null,
        fundingSourceId: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(errors.LifecycleError);
    await expect(service.withdrawMatchDraft(ctx, match.id)).rejects.toBeInstanceOf(
      errors.LifecycleError,
    );

    // Withdrawn is terminal: the participant may be drafted again now.
    const again = await service.createMatchDraft(ctx, { enrollmentId, siteId });
    expect(again.id).not.toBe(match.id);
  });

  it("proposes only a complete draft, resetting both decision tracks (4.4 AC1/AC2)", async () => {
    const ctx = await contextFor(coordinatorId);
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId, status: enums.MatchStatus.DRAFT },
    });

    // Incomplete draft: the missing core fields are NAMED.
    await expect(service.proposeMatch(ctx, match.id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("Candidate supervisor"),
    });

    await service.updateMatchDraft(ctx, match.id, {
      siteId,
      supervisorId: shelterUserId,
      schedule: "Tue/Thu afternoons",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-12-01T00:00:00.000Z"),
      fundingSourceId: null,
      notes: "Coordinator-internal rationale.",
    });
    await service.proposeMatch(ctx, match.id);

    const row = await prisma.placementMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(row.status).toBe(enums.MatchStatus.PROPOSED);
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.PENDING);
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.PENDING);
    expect(row.proposedAt).toBeInstanceOf(Date);
    expect(row.decisionWindowEndsAt!.getTime()).toBeGreaterThan(row.proposedAt!.getTime());

    await prisma.placementMatchEvent.findFirstOrThrow({
      where: { placementMatchId: match.id, toStatus: enums.MatchStatus.PROPOSED },
    });
    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "placementMatch.propose", subjectId: match.id },
    });
  });

  it("serves role-shaped views across the boundary — no notes, no snapshot (4.4 AC3/AC4/AC6)", async () => {
    const participantCtx = await contextFor(participantUserId);
    const own = await service.getOwnProposedMatch(participantCtx);
    expect(own?.schedule).toBe("Tue/Thu afternoons");
    expect(own?.organizationName).toContain("Host Shelter");
    const ownPayload = JSON.stringify(own);
    expect(ownPayload).not.toMatch(/rationale|coordinatorNotes|snapshot|category/i);

    const shelterCtx = await contextFor(shelterUserId);
    const approvals = await service.listShelterApprovals(shelterCtx);
    const row = approvals.find((a) => a.participantName.includes("ready"));
    expect(row).toBeDefined();
    expect(row?.supervisorName).toContain("Shelter Supervisor");
    expect(JSON.stringify(approvals)).not.toMatch(/rationale|coordinatorNotes|snapshot/i);

    // A different shelter's manager sees nothing of it; a participant has
    // no shelter scope at all.
    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });
    const otherManager = await prisma.user.create({
      data: {
        email: `${runId}-othermgr@synthetic.example`,
        displayName: testScopedName(runId, "Other Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: otherOrg.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    const otherCtx = await contextFor(otherManager.id);
    expect(await service.listShelterApprovals(otherCtx)).toEqual([]);
    await expect(service.listShelterApprovals(participantCtx)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });

  it("expires a stale, fully undecided proposal on access (4.4 AC5)", async () => {
    const match = await prisma.placementMatch.findFirstOrThrow({
      where: { programEnrollmentId: enrollmentId, status: enums.MatchStatus.PROPOSED },
    });
    await prisma.placementMatch.update({
      where: { id: match.id },
      data: { decisionWindowEndsAt: new Date("2026-01-01T00:00:00.000Z") },
    });

    const expired = await service.expireStaleProposals(new Date());
    expect(expired).toBeGreaterThanOrEqual(1);

    const row = await prisma.placementMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(row.status).toBe(enums.MatchStatus.EXPIRED);
    await prisma.placementMatchEvent.findFirstOrThrow({
      where: {
        placementMatchId: match.id,
        toStatus: enums.MatchStatus.EXPIRED,
        actorUserId: "system-expiration",
      },
    });

    // Dropped from both parties' active views.
    const participantCtx = await contextFor(participantUserId);
    expect(await service.getOwnProposedMatch(participantCtx)).toBeNull();
    const shelterCtx = await contextFor(shelterUserId);
    expect(
      (await service.listShelterApprovals(shelterCtx)).find((a) => a.id === match.id),
    ).toBeUndefined();
  });
});

describe.skipIf(hasDatabase)("placement match drafts (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
