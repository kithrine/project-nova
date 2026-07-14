import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate } from "@/server/domain/timesheet";

/**
 * Work entries against Neon (Story 6.2 + 6.3's integration ACs): CRUD
 * with server-computed hours and full-set total recalculation, the
 * spoofed-hours rejection, the DRAFT/REJECTED-only mutation window, the
 * week-window validation, and ownership scoping.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts62");

describe.skipIf(!hasDatabase)("timesheet work entries (integration)", () => {
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

  function dayIso(offset: number): string {
    return isoDate(new Date(weekStart.getTime() + offset * 86_400_000));
  }

  function entry(offset: number, start: string, end: string, breakMin = 0) {
    return {
      workDate: new Date(`${dayIso(offset)}T00:00:00.000Z`),
      startTime: start,
      endTime: end,
      breakMinutes: breakMin,
      note: null,
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
              dateOfBirth: new Date("1999-09-09T00:00:00Z"),
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
          status: enums.PlacementStatus.ACTIVE,
          startDate: new Date("2026-06-01T00:00:00Z"),
        },
      });
      return { userId: user.id, placementId: placement.id };
    }

    const owner = await chain("entow");
    ownerUserId = owner.userId;
    otherUserId = (await chain("entoth")).userId;

    // The owner's current-week timesheet via the real 6.1 path.
    const view = await service.getOrCreateOwnTimesheet(await contextFor(ownerUserId));
    timesheetId = view.week!.timesheetId!;
    weekStart = new Date(`${view.week!.weekStartIso}T00:00:00.000Z`);
  }, 90_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.workEntry.deleteMany({
      where: { timesheet: byParticipantUser },
    });
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

  it("adds entries with server-computed hours and a full-set total (AC1/AC6)", async () => {
    const owner = await contextFor(ownerUserId);
    await service.addWorkEntry(owner, timesheetId, entry(0, "08:00", "16:15", 30));
    await service.addWorkEntry(owner, timesheetId, entry(1, "09:00", "12:00"));

    const view = await service.getOrCreateOwnTimesheet(owner);
    expect(view.week!.totalHours).toBe("10.75");
    const monday = view.week!.days[0];
    expect(monday.entries).toHaveLength(1);
    expect(monday.entries[0].hours).toBe("7.75");
    expect(view.week!.days[1].entries[0].hours).toBe("3.00");
  });

  it("ignores any spoofed hours/totalHours value — always recalculated (6.3 AC3)", async () => {
    const owner = await contextFor(ownerUserId);
    const spoofed = {
      ...entry(2, "10:00", "11:00"),
      hours: "99.99",
      totalHours: "500.00",
    };
    await service.addWorkEntry(owner, timesheetId, spoofed as never);

    const stored = await prisma.workEntry.findFirst({
      where: { timesheetId, workDate: new Date(`${dayIso(2)}T00:00:00.000Z`) },
    });
    expect(stored!.hours.toFixed(2)).toBe("1.00");
    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
    });
    expect(sheet.totalHours.toFixed(2)).toBe("11.75");
  });

  it("validates the week window, times, and break server-side (AC3/AC4/AC5)", async () => {
    const owner = await contextFor(ownerUserId);
    await expect(
      service.addWorkEntry(owner, timesheetId, {
        ...entry(0, "09:00", "10:00"),
        workDate: new Date(`${isoDate(new Date(weekStart.getTime() + 9 * 86_400_000))}T00:00:00.000Z`),
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("inside this timesheet's week"),
    });
    await expect(
      service.addWorkEntry(owner, timesheetId, entry(0, "16:00", "09:00")),
    ).rejects.toMatchObject({
      message: expect.stringContaining("end after it starts"),
    });
    await expect(
      service.addWorkEntry(owner, timesheetId, entry(0, "09:00", "10:00", 90)),
    ).rejects.toMatchObject({
      message: expect.stringContaining("whole shift"),
    });
  });

  it("edits and removals recalculate from the full remaining set (AC6)", async () => {
    const owner = await contextFor(ownerUserId);
    const tuesday = await prisma.workEntry.findFirst({
      where: { timesheetId, workDate: new Date(`${dayIso(1)}T00:00:00.000Z`) },
    });
    await service.updateWorkEntry(owner, tuesday!.id, entry(1, "09:00", "13:30"));
    let sheet = await prisma.timesheet.findUniqueOrThrow({ where: { id: timesheetId } });
    expect(sheet.totalHours.toFixed(2)).toBe("13.25");

    const wednesday = await prisma.workEntry.findFirst({
      where: { timesheetId, workDate: new Date(`${dayIso(2)}T00:00:00.000Z`) },
    });
    await service.removeWorkEntry(owner, wednesday!.id);
    sheet = await prisma.timesheet.findUniqueOrThrow({ where: { id: timesheetId } });
    expect(sheet.totalHours.toFixed(2)).toBe("12.25");
    expect(await prisma.workEntry.count({ where: { timesheetId } })).toBe(2);
  });

  it("denies every mutation outside DRAFT/REJECTED and outside ownership (AC2)", async () => {
    const owner = await contextFor(ownerUserId);
    const other = await contextFor(otherUserId);
    const existing = await prisma.workEntry.findFirstOrThrow({
      where: { timesheetId },
    });

    // Another participant cannot touch the owner's timesheet or entries.
    await expect(
      service.addWorkEntry(other, timesheetId, entry(3, "09:00", "10:00")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.updateWorkEntry(other, existing.id, entry(1, "09:00", "10:00")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Once submitted, every mutation path is lifecycle-denied — even a
    // direct service call bypassing the UI.
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { status: enums.TimesheetStatus.SUBMITTED },
    });
    await expect(
      service.addWorkEntry(owner, timesheetId, entry(3, "09:00", "10:00")),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("after submission"),
    });
    await expect(
      service.updateWorkEntry(owner, existing.id, entry(1, "09:00", "10:00")),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(service.removeWorkEntry(owner, existing.id)).rejects.toMatchObject({
      code: "LIFECYCLE",
    });

    // REJECTED re-opens the editable window (business-rules.md).
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { status: enums.TimesheetStatus.REJECTED },
    });
    await expect(
      service.addWorkEntry(owner, timesheetId, entry(3, "09:00", "10:00")),
    ).resolves.toBeUndefined();
  });
});
