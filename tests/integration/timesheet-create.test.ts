import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate, mondayOfWeek } from "@/server/domain/timesheet";

/**
 * Weekly timesheet get-or-create against Neon (Story 6.1): idempotency
 * under reuse and race, the (placementId, weekStartDate) unique
 * constraint, ownership scoping through the Person -> Participant chain,
 * the ACTIVE-placement gate, and week-bound creation rules.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts61");

describe.skipIf(!hasDatabase)("weekly timesheet creation (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/timesheet-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let activeUserId: string;
  let onboardingUserId: string;
  let coordinatorId: string;
  let activePlacementId: string;

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
    service = await import("@/server/services/timesheet-service");
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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 4 }] },
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

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function chain(
      slug: string,
      status: "ACTIVE" | "ONBOARDING",
      novaOrgId: string,
      startDate: Date | null,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          memberships: {
            create: { organizationId: novaOrgId, role: enums.Role.PARTICIPANT },
          },
          person: {
            create: {
              legalFirstName: slug,
              legalLastName: testScopedName(runId, "Subject"),
              dateOfBirth: new Date("1997-07-07T00:00:00Z"),
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
          startDate,
        },
      });
      return { userId: user.id, placementId: placement.id };
    }

    const active = await chain("hrsact", "ACTIVE", nova.id, new Date("2026-06-01T00:00:00Z"));
    activeUserId = active.userId;
    activePlacementId = active.placementId;
    onboardingUserId = (await chain("hrsonb", "ONBOARDING", nova.id, null)).userId;
  }, 90_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.timesheetEvent.deleteMany({
      where: { timesheet: byParticipantUser },
    });
    await prisma.timesheet.deleteMany({ where: byParticipantUser });
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

  it("creates the current week's DRAFT once and reuses it forever after (AC1/AC2)", async () => {
    const participant = await contextFor(activeUserId);
    const first = await service.getOrCreateOwnTimesheet(participant);
    expect(first.week?.timesheetId).not.toBeNull();
    expect(first.week?.statusKey).toBe(enums.TimesheetStatus.DRAFT);
    expect(first.week?.totalHours).toBe("0.00");
    expect(first.week?.editable).toBe(true);
    expect(first.week?.weekStartIso).toBe(isoDate(mondayOfWeek(new Date())));

    const second = await service.getOrCreateOwnTimesheet(participant);
    expect(second.week?.timesheetId).toBe(first.week?.timesheetId);
    const count = await prisma.timesheet.count({
      where: { placementId: activePlacementId },
    });
    expect(count).toBe(1);

    // The creation event was written with the timesheet.
    const events = await prisma.timesheetEvent.findMany({
      where: { timesheetId: first.week!.timesheetId! },
    });
    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe(enums.TimesheetStatus.DRAFT);
    expect(events[0].fromStatus).toBeNull();
  });

  it("survives a double-open race through the unique constraint, never duplicating (AC2)", async () => {
    const participant = await contextFor(activeUserId);
    // Prior week (fresh) opened twice concurrently.
    const prior = new Date(mondayOfWeek(new Date()).getTime() - 7 * 86_400_000);
    const weekIso = isoDate(prior);
    const [a, b] = await Promise.all([
      service.getOrCreateOwnTimesheet(participant, weekIso),
      service.getOrCreateOwnTimesheet(participant, weekIso),
    ]);
    expect(a.week?.timesheetId).not.toBeNull();
    expect(a.week?.timesheetId).toBe(b.week?.timesheetId);
    const count = await prisma.timesheet.count({
      where: { placementId: activePlacementId, weekStartDate: prior },
    });
    expect(count).toBe(1);
  });

  it("blocks future weeks and pre-placement weeks with a stated reason (AC3/AC4)", async () => {
    const participant = await contextFor(activeUserId);
    const future = new Date(mondayOfWeek(new Date()).getTime() + 7 * 86_400_000);
    const futureView = await service.getOrCreateOwnTimesheet(participant, isoDate(future));
    expect(futureView.week?.timesheetId).toBeNull();
    expect(futureView.week?.blockedReason).toMatch(/future week/);

    const early = await service.getOrCreateOwnTimesheet(participant, "2026-05-04");
    expect(early.week?.timesheetId).toBeNull();
    expect(early.week?.blockedReason).toMatch(/before your placement began/);

    // A malformed or non-Monday week parameter falls back to the current
    // week instead of trusting client input (AC6 posture).
    const fallback = await service.getOrCreateOwnTimesheet(participant, "2026-07-15");
    expect(fallback.week?.weekStartIso).toBe(isoDate(mondayOfWeek(new Date())));
  });

  it("denies new timesheets while the placement is not ACTIVE (AC5)", async () => {
    const participant = await contextFor(onboardingUserId);
    const view = await service.getOrCreateOwnTimesheet(participant);
    expect(view.week?.timesheetId).toBeNull();
    expect(view.week?.blockedReason).toMatch(/while your placement is active/);
    // ...while a Nova coordinator (no participant chain, no
    // timesheet.create) cannot reach the surface at all (AC6 scoping).
    const coordinator = await contextFor(coordinatorId);
    await expect(service.getOrCreateOwnTimesheet(coordinator)).rejects.toMatchObject({
      code: "AUTHORIZATION",
    });
  });
});
