import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate } from "@/server/domain/timesheet";

/**
 * Locking against Neon (Story 6.7): APPROVED -> LOCKED by Nova roles
 * with oversight, a distinct audit event, and the no-silent-edit
 * battery — every mutation path against a LOCKED (and APPROVED) week
 * denied server-side for every actor.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts67");

describe.skipIf(!hasDatabase)("timesheet locking (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/timesheet-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let grantAdminId: string;
  let managerId: string;
  let participantUserId: string;
  let approvedA: string; // locked by the coordinator
  let approvedB: string; // locked by the Grant Administrator
  let submittedC: string;

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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 6 }] },
      },
      include: { sites: true },
    });

    const mkStaff = async (slug: string, orgId: string, role: keyof typeof enums.Role) =>
      (
        await prisma.user.create({
          data: {
            email: `${runId}-${slug}@synthetic.example`,
            displayName: testScopedName(runId, slug),
            isSynthetic: true,
            memberships: { create: { organizationId: orgId, role: enums.Role[role] } },
          },
        })
      ).id;
    coordinatorId = await mkStaff("pc", nova.id, "PROGRAM_COORDINATOR");
    grantAdminId = await mkStaff("ga", nova.id, "GRANT_ADMINISTRATOR");
    managerId = await mkStaff("mgr", host.id, "SHELTER_MANAGER");

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function weekFor(slug: string) {
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
              dateOfBirth: new Date("2003-03-03T00:00:00Z"),
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
      const ctx = await contextFor(user.id);
      const view = await service.getOrCreateOwnTimesheet(ctx);
      const timesheetId = view.week!.timesheetId!;
      await service.addWorkEntry(ctx, timesheetId, {
        workDate: new Date(`${view.week!.weekStartIso}T00:00:00.000Z`),
        startTime: "08:00",
        endTime: "16:15",
        breakMinutes: 30,
        note: null,
      });
      await service.submitOwnTimesheet(ctx, timesheetId);
      return { timesheetId, userId: user.id, weekStartIso: view.week!.weekStartIso };
    }

    const a = await weekFor("lka");
    approvedA = a.timesheetId;
    participantUserId = a.userId;
    const b = await weekFor("lkb");
    approvedB = b.timesheetId;
    submittedC = (await weekFor("lkc")).timesheetId;

    const coordinator = await contextFor(coordinatorId);
    await service.approveTimesheet(coordinator, approvedA);
    await service.approveTimesheet(coordinator, approvedB);
  }, 120_000);

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

  it("locks an approved week with locker identity and a distinct audit event (AC1/AC5)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await service.lockTimesheet(coordinator, approvedA);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: approvedA },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.LOCKED);
    expect(sheet.lockedByUserId).toBe(coordinatorId);
    expect(sheet.lockedAt).not.toBeNull();

    const audits = await prisma.auditEvent.findMany({
      where: { subjectType: "Timesheet", subjectId: approvedA },
      orderBy: { createdAt: "asc" },
    });
    const actions = audits.map((audit) => audit.action);
    expect(actions).toContain("timesheet.approve");
    expect(actions).toContain("timesheet.lock");
    const lockAudit = audits.find((audit) => audit.action === "timesheet.lock");
    expect(lockAudit?.detail).toBe("final for reporting: 7.75 hours");

    // The Grant Administrator — funding oversight — locks too (AC1 authz).
    const grantAdmin = await contextFor(grantAdminId);
    await service.lockTimesheet(grantAdmin, approvedB);
    const sheetB = await prisma.timesheet.findUniqueOrThrow({
      where: { id: approvedB },
    });
    expect(sheetB.lockedByUserId).toBe(grantAdminId);
  });

  it("rejects locking outside APPROVED and by non-Nova roles (AC2/AC4)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await expect(service.lockTimesheet(coordinator, submittedC)).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("approved timesheet"),
    });
    await expect(service.lockTimesheet(coordinator, approvedA)).rejects.toMatchObject({
      code: "LIFECYCLE",
    });
    const manager = await contextFor(managerId);
    await expect(service.lockTimesheet(manager, approvedB)).rejects.toMatchObject({
      code: "AUTHORIZATION",
    });
  });

  it("leaves no silent-edit path on a LOCKED week for any actor (AC3/AC6)", async () => {
    const participant = await contextFor(participantUserId);
    const entry = await prisma.workEntry.findFirstOrThrow({
      where: { timesheetId: approvedA },
    });

    // The participant: no entry mutation, no resubmission.
    await expect(
      service.addWorkEntry(participant, approvedA, {
        workDate: entry.workDate,
        startTime: "09:00",
        endTime: "10:00",
        breakMinutes: 0,
        note: null,
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(
      service.updateWorkEntry(participant, entry.id, {
        workDate: entry.workDate,
        startTime: "09:00",
        endTime: "10:00",
        breakMinutes: 0,
        note: null,
      }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(service.removeWorkEntry(participant, entry.id)).rejects.toMatchObject({
      code: "LIFECYCLE",
    });
    await expect(
      service.submitOwnTimesheet(participant, approvedA),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });

    // Reviewers: no approve, no reject, no re-lock — LOCKED is terminal.
    const coordinator = await contextFor(coordinatorId);
    await expect(service.approveTimesheet(coordinator, approvedA)).rejects.toMatchObject({
      code: "LIFECYCLE",
    });
    await expect(
      service.rejectTimesheet(coordinator, approvedA, "attempt"),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(service.lockTimesheet(coordinator, approvedA)).rejects.toMatchObject({
      code: "LIFECYCLE",
    });

    // The row is bit-for-bit final.
    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: approvedA },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.LOCKED);
    expect(sheet.totalHours.toFixed(2)).toBe("7.75");
    expect(isoDate(sheet.lockedAt!)).toBe(isoDate(new Date()));
  });
});
