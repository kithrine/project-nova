import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Terminal outcomes against Neon (Story 5.8; ADR-018): the four endings
 * from Active/Paused with reason detail on the lifecycle event, the
 * Employment Outcome created atomically on conversion, Nova-only
 * single-actor authorization, and terminal immutability — no reopening
 * through any path.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla58");

describe.skipIf(!hasDatabase)("placement terminal outcomes (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let completeId: string;
  let convertId: string;
  let withdrawId: string;
  let terminateId: string;
  let onboardingId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  const EFFECTIVE = new Date("2026-09-30T00:00:00.000Z");

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/placement-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 6 }] },
      },
      include: { sites: true },
    });

    coordinatorId = (
      await prisma.user.create({
        data: {
          email: `${runId}-pc@synthetic.example`,
          displayName: testScopedName(runId, "Coordinator"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
          },
        },
      })
    ).id;
    managerId = (
      await prisma.user.create({
        data: {
          email: `${runId}-mgr@synthetic.example`,
          displayName: testScopedName(runId, "Manager"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: host.id, role: enums.Role.SHELTER_MANAGER },
          },
        },
      })
    ).id;

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function chain(slug: string, status: keyof typeof enums.PlacementStatus) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: slug,
              legalLastName: testScopedName(runId, "Subject"),
              dateOfBirth: new Date("1995-05-05T00:00:00Z"),
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
          applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
          status: enums.ApplicationStatus.ACCEPTED,
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
      });
      const participant = await prisma.participant.create({
        data: { personId: person.id },
      });
      const enrollment = await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId: program.id,
          applicationId: application.id,
          status: enums.EnrollmentStatus.READY_FOR_MATCHING,
        },
      });
      const match = await prisma.placementMatch.create({
        data: {
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          status: enums.MatchStatus.APPROVED,
          participantDecision: enums.ParticipantMatchDecision.ACCEPTED,
          shelterDecision: enums.ShelterMatchDecision.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: match.id,
          status: enums.PlacementStatus[status],
        },
      });
      return placement.id;
    }

    completeId = await chain("done", "ACTIVE");
    convertId = await chain("hire", "ACTIVE");
    withdrawId = await chain("wdrw", "PAUSED");
    terminateId = await chain("term", "ACTIVE");
    onboardingId = await chain("onbd", "ONBOARDING");
  }, 90_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.employmentOutcome.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementEvent.deleteMany({ where: byParticipantUser });
    await prisma.placement.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
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
  }, 60_000);

  it("marks a successful natural end with effective date, event, and audit (AC1)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await service.recordTerminalOutcome(coordinator, completeId, {
      outcome: "COMPLETED",
      effectiveDate: EFFECTIVE,
      note: "Finished the full placement period.",
    });

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: completeId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(placement.status).toBe(enums.PlacementStatus.COMPLETED);
    expect(placement.endDate?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(placement.events[0].fromStatus).toBe(enums.PlacementStatus.ACTIVE);
    expect(placement.events[0].toStatus).toBe(enums.PlacementStatus.COMPLETED);
    expect(placement.events[0].detail).toBe(
      "Completed effective September 30, 2026 — Finished the full placement period.",
    );

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "placement.complete",
        subjectType: "Placement",
        subjectId: completeId,
      },
    });
    expect(audit?.detail).toBe("Completed");
  });

  it("never reopens a terminal placement — no transition out exists (AC4)", async () => {
    const coordinator = await contextFor(coordinatorId);
    for (const outcome of ["COMPLETED", "WITHDRAWN", "TERMINATED"] as const) {
      await expect(
        service.recordTerminalOutcome(coordinator, completeId, {
          outcome,
          effectiveDate: EFFECTIVE,
          note: "again",
          reasonCategory: "OTHER",
        }),
      ).rejects.toMatchObject({ code: "LIFECYCLE" });
    }
    // The workspace offers no outcome controls on a terminal placement.
    const view = await service.getPlacementWorkspace(coordinator, completeId);
    expect(view.viewerCanRecordOutcome).toBe(false);
    expect(view.viewerCanTerminate).toBe(false);
  });

  it("creates the Employment Outcome atomically on conversion (AC2)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await service.recordTerminalOutcome(coordinator, convertId, {
      outcome: "CONVERTED_TO_PERMANENT",
      effectiveDate: EFFECTIVE,
      note: null,
      employerName: "Harbor Haven Shelter",
      jobTitle: "Kennel technician",
    });

    const outcome = await prisma.employmentOutcome.findUniqueOrThrow({
      where: { placementId: convertId },
    });
    expect(outcome.employerName).toBe("Harbor Haven Shelter");
    expect(outcome.jobTitle).toBe("Kennel technician");
    expect(outcome.hiredOn.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(outcome.recordedByUserId).toBe(coordinatorId);

    const view = await service.getPlacementWorkspace(coordinator, convertId);
    expect(view.status).toBe(enums.PlacementStatus.CONVERTED_TO_PERMANENT);
    expect(view.outcome).toEqual({
      hiredOnLabel: "September 30, 2026",
      employerName: "Harbor Haven Shelter",
      jobTitle: "Kennel technician",
    });

    // One outcome per placement, enforced by the unique constraint.
    await expect(
      prisma.employmentOutcome.create({
        data: {
          placementId: convertId,
          participantId: outcome.participantId,
          hiredOn: EFFECTIVE,
          employerName: "Duplicate",
          recordedByUserId: coordinatorId,
        },
      }),
    ).rejects.toThrowError(/Unique constraint|P2002/);
  });

  it("records a withdrawal from Paused with the participant's stated reason (AC3)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await expect(
      service.recordTerminalOutcome(coordinator, withdrawId, {
        outcome: "WITHDRAWN",
        effectiveDate: EFFECTIVE,
        note: null,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("stated reason"),
    });

    await service.recordTerminalOutcome(coordinator, withdrawId, {
      outcome: "WITHDRAWN",
      effectiveDate: EFFECTIVE,
      note: "Moving out of the area.",
    });
    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: withdrawId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(placement.status).toBe(enums.PlacementStatus.WITHDRAWN);
    expect(placement.events[0].fromStatus).toBe(enums.PlacementStatus.PAUSED);
    expect(placement.events[0].detail).toContain("Moving out of the area.");
  });

  it("terminates per ADR-018: required category and note, category in audit, note never (AC5)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await expect(
      service.recordTerminalOutcome(coordinator, terminateId, {
        outcome: "TERMINATED",
        effectiveDate: EFFECTIVE,
        note: "context",
        reasonCategory: "NOT_A_CATEGORY",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.recordTerminalOutcome(coordinator, terminateId, {
        outcome: "TERMINATED",
        effectiveDate: EFFECTIVE,
        note: null,
        reasonCategory: "SAFETY_CONCERN",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("note is required"),
    });

    const NOTE = "Repeated unsafe handling after coaching and warnings.";
    await service.recordTerminalOutcome(coordinator, terminateId, {
      outcome: "TERMINATED",
      effectiveDate: EFFECTIVE,
      note: NOTE,
      reasonCategory: "SAFETY_CONCERN",
    });

    const placement = await prisma.placement.findUniqueOrThrow({
      where: { id: terminateId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(placement.status).toBe(enums.PlacementStatus.TERMINATED);
    expect(placement.events[0].detail).toBe(
      `Terminated (Safety concern) effective September 30, 2026 — ${NOTE}`,
    );

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "placement.terminate",
        subjectType: "Placement",
        subjectId: terminateId,
      },
    });
    expect(audit?.detail).toBe("Terminated (Safety concern)");
    expect(audit?.detail).not.toContain("coaching");
  });

  it("rejects endings before the placement is Active or Paused", async () => {
    const coordinator = await contextFor(coordinatorId);
    await expect(
      service.recordTerminalOutcome(coordinator, onboardingId, {
        outcome: "COMPLETED",
        effectiveDate: EFFECTIVE,
        note: null,
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  });

  it("denies every terminal outcome to shelter roles server-side (ADR-018/AC6)", async () => {
    const manager = await contextFor(managerId);
    for (const outcome of ["COMPLETED", "CONVERTED_TO_PERMANENT", "WITHDRAWN", "TERMINATED"] as const) {
      await expect(
        service.recordTerminalOutcome(manager, onboardingId, {
          outcome,
          effectiveDate: EFFECTIVE,
          note: "attempt",
          reasonCategory: "OTHER",
          employerName: "x",
        }),
      ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    }
    // Shelter view of an active placement offers no outcome controls.
    const view = await service.getPlacementWorkspace(manager, onboardingId);
    expect(view.viewerCanRecordOutcome).toBe(false);
    expect(view.viewerCanTerminate).toBe(false);
  });
});
