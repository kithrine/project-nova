import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate } from "@/server/domain/timesheet";

/**
 * Timesheet submission against Neon (Story 6.4): the transactional
 * DRAFT/REJECTED -> SUBMITTED transition with a FRESH total
 * recalculation, the at-least-one-entry rule, replay/staleness
 * rejection, resubmission preserving the event trail, and post-submit
 * edit freezing.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts64");

describe.skipIf(!hasDatabase)("timesheet submission (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/timesheet-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let ownerUserId: string;
  let otherUserId: string;
  let timesheetId: string;
  let weekStart: Date;

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
    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function chain(slug: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.PARTICIPANT },
          },
          person: {
            create: {
              legalFirstName: slug,
              legalLastName: testScopedName(runId, "Subject"),
              dateOfBirth: new Date("2000-01-01T00:00:00Z"),
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
      await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: match.id,
          status: enums.PlacementStatus.ACTIVE,
          startDate: new Date("2026-06-01T00:00:00Z"),
        },
      });
      return { userId: user.id };
    }

    ownerUserId = (await chain("subow")).userId;
    otherUserId = (await chain("suboth")).userId;

    const view = await service.getOrCreateOwnTimesheet(await contextFor(ownerUserId));
    timesheetId = view.week!.timesheetId!;
    weekStart = new Date(`${view.week!.weekStartIso}T00:00:00.000Z`);
  }, 90_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.workEntry.deleteMany({ where: { timesheet: byParticipantUser } });
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

  it("blocks an empty week with the specific at-least-one-entry message (AC2)", async () => {
    const owner = await contextFor(ownerUserId);
    await expect(service.submitOwnTimesheet(owner, timesheetId)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("at least one work day"),
    });
  });

  it("submits transactionally with a FRESH server total, event, and audit (AC1/AC5)", async () => {
    const owner = await contextFor(ownerUserId);
    await service.addWorkEntry(owner, timesheetId, {
      workDate: new Date(`${isoDate(weekStart)}T00:00:00.000Z`),
      startTime: "08:00",
      endTime: "16:15",
      breakMinutes: 30,
      note: null,
    });
    // Tamper with the stored total — submission must recompute, never
    // trust the last-saved value (AC5).
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { totalHours: "99.99" },
    });

    await service.submitOwnTimesheet(owner, timesheetId);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.SUBMITTED);
    expect(sheet.submittedAt).not.toBeNull();
    expect(sheet.totalHours.toFixed(2)).toBe("7.75");

    const events = await prisma.timesheetEvent.findMany({
      where: { timesheetId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.toStatus)).toEqual([
      enums.TimesheetStatus.DRAFT,
      enums.TimesheetStatus.SUBMITTED,
    ]);

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "timesheet.submit",
        subjectType: "Timesheet",
        subjectId: timesheetId,
      },
    });
    expect(audit?.detail).toBe("7.75 hours");
  });

  it("rejects replays, freezes edits, and stays owner-only (AC4/AC6)", async () => {
    const owner = await contextFor(ownerUserId);
    // A stale tab replaying submit.
    await expect(service.submitOwnTimesheet(owner, timesheetId)).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("already submitted"),
    });
    // A stale entry save after submission.
    await expect(
      service.addWorkEntry(owner, timesheetId, {
        workDate: new Date(`${isoDate(weekStart)}T00:00:00.000Z`),
        startTime: "09:00",
        endTime: "10:00",
        breakMinutes: 0,
        note: null,
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    // Another participant can't submit someone else's week.
    const other = await contextFor(otherUserId);
    await expect(service.submitOwnTimesheet(other, timesheetId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("resubmits a REJECTED week through the same action, preserving the trail (AC3)", async () => {
    const owner = await contextFor(ownerUserId);
    // 6.6 owns the real reject action; simulate its outcome directly.
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { status: enums.TimesheetStatus.REJECTED, rejectedAt: new Date() },
    });
    await prisma.timesheetEvent.create({
      data: {
        timesheetId,
        fromStatus: enums.TimesheetStatus.SUBMITTED,
        toStatus: enums.TimesheetStatus.REJECTED,
        actorUserId: ownerUserId,
      },
    });

    await service.submitOwnTimesheet(owner, timesheetId);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.SUBMITTED);

    const events = await prisma.timesheetEvent.findMany({
      where: { timesheetId },
      orderBy: { createdAt: "asc" },
    });
    // The full history — including the rejection cycle — is preserved.
    expect(events.map((event) => event.toStatus)).toEqual([
      enums.TimesheetStatus.DRAFT,
      enums.TimesheetStatus.SUBMITTED,
      enums.TimesheetStatus.REJECTED,
      enums.TimesheetStatus.SUBMITTED,
    ]);
  });
});
