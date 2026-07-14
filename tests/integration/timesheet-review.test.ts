import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate } from "@/server/domain/timesheet";

/**
 * Shelter approval against Neon (Story 6.5) — the canonical
 * Authorization = Permission + Resource Scope + Lifecycle State example:
 * assigned-supervisor approval, the unassigned-supervisor and cross-org
 * denials, Nova standing in, lifecycle errors, and the concurrent
 * reviewer race resolving to exactly one outcome.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts65");

describe.skipIf(!hasDatabase)("timesheet approval (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/timesheet-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let assignedSupervisorId: string;
  let unassignedSupervisorId: string;
  let otherOrgManagerId: string;
  let coordinatorId: string;
  let submittedA: string; // approved by the assigned supervisor
  let submittedB: string; // approved by Nova standing in
  let submittedC: string; // the race
  let draftD: string;

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
    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
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

    assignedSupervisorId = await mkStaff("supa", host.id, "SHELTER_SUPERVISOR");
    unassignedSupervisorId = await mkStaff("supb", host.id, "SHELTER_SUPERVISOR");
    otherOrgManagerId = await mkStaff("mgr2", otherOrg.id, "SHELTER_MANAGER");
    coordinatorId = await mkStaff("pc", nova.id, "PROGRAM_COORDINATOR");

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function submittedTimesheet(slug: string, submit = true) {
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
              dateOfBirth: new Date("2001-01-01T00:00:00Z"),
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
          supervisorId: assignedSupervisorId,
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
      if (submit) await service.submitOwnTimesheet(ctx, timesheetId);
      return timesheetId;
    }

    submittedA = await submittedTimesheet("tsa");
    submittedB = await submittedTimesheet("tsb");
    submittedC = await submittedTimesheet("tsc");
    draftD = await submittedTimesheet("tsd", false);
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

  it("queues submitted weeks for the host organization, oldest first (AC1 surface)", async () => {
    const supervisor = await contextFor(assignedSupervisorId);
    const rows = await service.listShelterTimesheetQueue(supervisor);
    const mine = rows.filter((row) =>
      [submittedA, submittedB, submittedC].includes(row.timesheetId),
    );
    expect(mine).toHaveLength(3);
    expect(mine[0].totalHours).toBe("7.75");

    // The other organization's queue never carries them (AC3 surface).
    const outsider = await contextFor(otherOrgManagerId);
    const theirRows = await service.listShelterTimesheetQueue(outsider);
    expect(
      theirRows.filter((row) =>
        [submittedA, submittedB, submittedC].includes(row.timesheetId),
      ),
    ).toHaveLength(0);
    await expect(
      service.getTimesheetReview(outsider, submittedA),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("approves via the assigned supervisor with approver, event, and audit (AC1)", async () => {
    const supervisor = await contextFor(assignedSupervisorId);
    const review = await service.getTimesheetReview(supervisor, submittedA);
    expect(review.viewerCanApprove).toBe(true);
    expect(review.days.some((day) => day.entries.length > 0)).toBe(true);

    await service.approveTimesheet(supervisor, submittedA);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: submittedA },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.APPROVED);
    expect(sheet.approvedByUserId).toBe(assignedSupervisorId);
    expect(sheet.approvedAt).not.toBeNull();

    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "timesheet.approve",
        subjectType: "Timesheet",
        subjectId: submittedA,
      },
    });
    expect(audit?.detail).toBe("7.75 hours");
  });

  it("denies a same-org supervisor without standing, even with the permission (AC2)", async () => {
    const unassigned = await contextFor(unassignedSupervisorId);
    const review = await service.getTimesheetReview(unassigned, submittedB);
    expect(review.viewerCanApprove).toBe(false);
    await expect(
      service.approveTimesheet(unassigned, submittedB),
    ).rejects.toMatchObject({
      code: "AUTHORIZATION",
      message: expect.stringContaining("assigned supervisor or a Shelter Manager"),
    });
  });

  it("lets authorized Nova staff stand in, recording their identity (AC4)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await service.approveTimesheet(coordinator, submittedB);
    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: submittedB },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.APPROVED);
    expect(sheet.approvedByUserId).toBe(coordinatorId);
  });

  it("rejects approval outside SUBMITTED as a lifecycle error (AC5)", async () => {
    const supervisor = await contextFor(assignedSupervisorId);
    await expect(service.approveTimesheet(supervisor, draftD)).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("submitted timesheet"),
    });
    // Already-approved is equally final for a second approval attempt.
    await expect(
      service.approveTimesheet(supervisor, submittedA),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  });

  it("resolves concurrent reviewers to exactly one outcome (AC6)", async () => {
    const supervisor = await contextFor(assignedSupervisorId);
    const coordinator = await contextFor(coordinatorId);
    const results = await Promise.allSettled([
      service.approveTimesheet(supervisor, submittedC),
      service.approveTimesheet(coordinator, submittedC),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: submittedC },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.APPROVED);
    const approvalEvents = await prisma.timesheetEvent.count({
      where: { timesheetId: submittedC, toStatus: enums.TimesheetStatus.APPROVED },
    });
    expect(approvalEvents).toBe(1);
    expect(isoDate(sheet.approvedAt!)).toBe(isoDate(new Date()));
  });
});
