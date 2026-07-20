import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Participant home placed-state reads against Neon: getOwnPlacement must
 * surface the active-tier placement (the one the partial unique index
 * guarantees is singular) even when a terminal record is newer, and the
 * dashboard's this-week hours read must never create a timesheet — My
 * Hours (6.1) owns creation.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("phome");

describe.skipIf(!hasDatabase)("participant home placed-state (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let placements: typeof import("@/server/services/placement-service");
  let timesheets: typeof import("@/server/services/timesheet-service");
  let timesheetDomain: typeof import("@/server/domain/timesheet");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let activeOwnerUserId: string;
  let historyOwnerUserId: string;
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
    placements = await import("@/server/services/placement-service");
    timesheets = await import("@/server/services/timesheet-service");
    timesheetDomain = await import("@/server/domain/timesheet");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

    const host = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Host Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: {
          create: [
            {
              name: testScopedName(runId, "Main Site"),
              city: "Springfield",
              region: "CO",
              capacity: 2,
            },
          ],
        },
      },
      include: { sites: true },
    });
    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function createParticipant(tag: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Home",
              legalLastName: testScopedName(runId, tag),
              dateOfBirth: new Date("1992-02-02T00:00:00Z"),
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
          applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
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
      return {
        userId: user.id,
        participantId: participant.id,
        enrollmentId: enrollment.id,
      };
    }

    async function createPlacement(
      tag: string,
      participant: { participantId: string; enrollmentId: string },
      status: "ACTIVE" | "COMPLETED" | "WITHDRAWN",
      createdAt: Date,
    ) {
      const sourceMatch = await prisma.placementMatch.create({
        data: {
          participantId: participant.participantId,
          programEnrollmentId: participant.enrollmentId,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          status: enums.MatchStatus.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.participantId,
          programEnrollmentId: participant.enrollmentId,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus[status],
          schedule: "Tue/Thu mornings",
          startDate: new Date("2026-06-01T00:00:00Z"),
          createdAt,
        },
      });
      return placement.id;
    }

    // The reported shape: an ACTIVE placement plus a NEWER terminal record
    // (a completed earlier stint recreated later by ops workflows).
    const activeOwner = await createParticipant("live");
    activeOwnerUserId = activeOwner.userId;
    activePlacementId = await createPlacement(
      "live",
      activeOwner,
      "ACTIVE",
      new Date("2026-06-01T00:00:00Z"),
    );
    await createPlacement("hist", activeOwner, "COMPLETED", new Date("2026-07-01T00:00:00Z"));

    // A participant whose only placement ended — history, never "placed".
    const historyOwner = await createParticipant("done");
    historyOwnerUserId = historyOwner.userId;
    await createPlacement("gone", historyOwner, "WITHDRAWN", new Date("2026-07-01T00:00:00Z"));

    // An approved current-week timesheet on the ACTIVE placement.
    const weekStart = timesheetDomain.mondayOfWeek(new Date());
    await prisma.timesheet.create({
      data: {
        placementId: activePlacementId,
        weekStartDate: weekStart,
        weekEndDate: timesheetDomain.weekEndFor(weekStart),
        status: enums.TimesheetStatus.APPROVED,
        totalHours: "7.50",
      },
    });
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.timesheet.deleteMany({
      where: { placement: { participant: { person: { user: { email: emails } } } } },
    });
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
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("surfaces the active-tier placement over a newer terminal record, marked active", async () => {
    const ctx = await contextFor(activeOwnerUserId);
    const own = await placements.getOwnPlacement(ctx);

    expect(own?.placementNumber).toContain("LIVE");
    expect(own?.active).toBe(true);
    expect(own?.stageLabel).toBe("Active");
    // The plain-language contract holds: no raw enum names in the payload.
    expect(JSON.stringify(own)).not.toMatch(/ACTIVE"|ONBOARDING|SHELTER_REVIEW/);
  }, 20_000);

  it("keeps a terminal-only placement as inactive history", async () => {
    const ctx = await contextFor(historyOwnerUserId);
    const own = await placements.getOwnPlacement(ctx);

    expect(own?.placementNumber).toContain("GONE");
    expect(own?.active).toBe(false);
    expect(own?.stageLabel).toBe("Ended");
  }, 20_000);

  it("reads this week's approved hours without ever creating a timesheet", async () => {
    const ctx = await contextFor(activeOwnerUserId);
    const week = await timesheets.getOwnCurrentWeekHours(ctx);

    expect(week).toMatchObject({ totalHours: "7.50", statusLabel: "Approved" });
    expect(week?.weekLabel).toBe(
      timesheetDomain.weekLabel(timesheetDomain.mondayOfWeek(new Date())),
    );
    // Read-only: the one seeded timesheet is still the only one.
    expect(await prisma.timesheet.count({ where: { placementId: activePlacementId } })).toBe(1);
  }, 20_000);

  it("returns a zero-shaped week before any hours exist, creating nothing", async () => {
    // Remove the seeded week: the dashboard read must not re-create it.
    await prisma.timesheet.deleteMany({ where: { placementId: activePlacementId } });
    const ctx = await contextFor(activeOwnerUserId);
    const week = await timesheets.getOwnCurrentWeekHours(ctx);

    expect(week).toMatchObject({ totalHours: "0.00", statusLabel: null });
    expect(await prisma.timesheet.count({ where: { placementId: activePlacementId } })).toBe(0);
  }, 20_000);

  it("returns null for a participant with no active-tier placement", async () => {
    const ctx = await contextFor(historyOwnerUserId);
    expect(await timesheets.getOwnCurrentWeekHours(ctx)).toBeNull();
  }, 20_000);
});
