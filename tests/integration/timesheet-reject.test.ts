import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";
import { isoDate } from "@/server/domain/timesheet";

/**
 * Rejection for correction against Neon (Story 6.6): the required
 * rationale, the shared standing rule, the participant-facing reason,
 * and the full cycle — reject, edit, resubmit (row cleared, trail
 * preserved), approve — with the reason surviving in history.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("ts66");

describe.skipIf(!hasDatabase)("timesheet rejection (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/timesheet-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let supervisorId: string;
  let unassignedSupervisorId: string;
  let participantUserId: string;
  let timesheetId: string;
  let weekStart: Date;

  const REASON = "Thursday looks like two shifts — please split it.";

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

    const mkStaff = async (slug: string, role: keyof typeof enums.Role) =>
      (
        await prisma.user.create({
          data: {
            email: `${runId}-${slug}@synthetic.example`,
            displayName: testScopedName(runId, slug),
            isSynthetic: true,
            memberships: {
              create: { organizationId: host.id, role: enums.Role[role] },
            },
          },
        })
      ).id;
    supervisorId = await mkStaff("supa", "SHELTER_SUPERVISOR");
    unassignedSupervisorId = await mkStaff("supb", "SHELTER_SUPERVISOR");

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });
    const user = await prisma.user.create({
      data: {
        email: `${runId}-part@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.PARTICIPANT },
        },
        person: {
          create: {
            legalFirstName: "Reject",
            legalLastName: testScopedName(runId, "Subject"),
            dateOfBirth: new Date("2002-02-02T00:00:00Z"),
          },
        },
      },
    });
    participantUserId = user.id;
    const person = await prisma.person.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-REJ1`,
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
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-REJ1`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        sourceMatchId: match.id,
        status: enums.PlacementStatus.ACTIVE,
        startDate: new Date("2026-06-01T00:00:00Z"),
        supervisorId,
      },
    });

    const ctx = await contextFor(participantUserId);
    const view = await service.getOrCreateOwnTimesheet(ctx);
    timesheetId = view.week!.timesheetId!;
    weekStart = new Date(`${view.week!.weekStartIso}T00:00:00.000Z`);
    await service.addWorkEntry(ctx, timesheetId, {
      workDate: new Date(`${isoDate(weekStart)}T00:00:00.000Z`),
      startTime: "08:00",
      endTime: "16:15",
      breakMinutes: 30,
      note: null,
    });
    await service.submitOwnTimesheet(ctx, timesheetId);
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

  it("requires a rationale and the shared standing (AC2/AC4)", async () => {
    const supervisor = await contextFor(supervisorId);
    await expect(
      service.rejectTimesheet(supervisor, timesheetId, "   "),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("participant sees this reason"),
    });
    const unassigned = await contextFor(unassignedSupervisorId);
    await expect(
      service.rejectTimesheet(unassigned, timesheetId, REASON),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("rejects with reviewer, reason, event detail, and content-free audit (AC1/AC6)", async () => {
    const supervisor = await contextFor(supervisorId);
    await service.rejectTimesheet(supervisor, timesheetId, REASON);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.REJECTED);
    expect(sheet.rejectedByUserId).toBe(supervisorId);
    expect(sheet.rejectionReason).toBe(REASON);

    const event = await prisma.timesheetEvent.findFirst({
      where: { timesheetId, toStatus: enums.TimesheetStatus.REJECTED },
    });
    expect(event?.detail).toBe(`Correction requested: ${REASON}`);
    const audit = await prisma.auditEvent.findFirst({
      where: {
        action: "timesheet.reject",
        subjectType: "Timesheet",
        subjectId: timesheetId,
      },
    });
    expect(audit?.detail).toBe("correction requested");
    expect(JSON.stringify(audit)).not.toContain("Thursday");

    // A second reject on the now-REJECTED sheet is a lifecycle error (AC5).
    await expect(
      service.rejectTimesheet(supervisor, timesheetId, "again"),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  });

  it("shows the participant the specific respectful reason and re-opens editing (AC3)", async () => {
    const participant = await contextFor(participantUserId);
    const view = await service.getOrCreateOwnTimesheet(participant);
    expect(view.week!.statusKey).toBe(enums.TimesheetStatus.REJECTED);
    expect(view.week!.editable).toBe(true);
    expect(view.week!.statusNoteKind).toBe("correction");
    expect(view.week!.statusNote).toContain("asked for a correction on your hours");
    expect(view.week!.statusNote).toContain(REASON);

    // Editing works again — the participant fixes Thursday.
    await service.addWorkEntry(participant, timesheetId, {
      workDate: new Date(`${isoDate(weekStart)}T00:00:00.000Z`),
      startTime: "17:00",
      endTime: "19:00",
      breakMinutes: 0,
      note: "Split evening shift",
    });
  });

  it("resubmission clears the row's correction fields but the trail keeps the reason (6.4 AC3/AC6)", async () => {
    const participant = await contextFor(participantUserId);
    await service.submitOwnTimesheet(participant, timesheetId);

    const sheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
    });
    expect(sheet.status).toBe(enums.TimesheetStatus.SUBMITTED);
    expect(sheet.rejectionReason).toBeNull();
    expect(sheet.rejectedByUserId).toBeNull();
    expect(sheet.totalHours.toFixed(2)).toBe("9.75");

    // Approve the corrected week; the rejection remains in history.
    const supervisor = await contextFor(supervisorId);
    await service.approveTimesheet(supervisor, timesheetId);
    const events = await prisma.timesheetEvent.findMany({
      where: { timesheetId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.toStatus)).toEqual([
      enums.TimesheetStatus.DRAFT,
      enums.TimesheetStatus.SUBMITTED,
      enums.TimesheetStatus.REJECTED,
      enums.TimesheetStatus.SUBMITTED,
      enums.TimesheetStatus.APPROVED,
    ]);
    expect(
      events.find((event) => event.toStatus === enums.TimesheetStatus.REJECTED)
        ?.detail,
    ).toContain(REASON);
  });
});
