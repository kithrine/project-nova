import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Approved hours by funding source against Neon (Story 7.2; ADR-020):
 * exact Decimal grouping, single-source attribution (ADR-010, no
 * blending), Monday-based range attribution, LOCKED/APPROVED separation,
 * Nova-scope enforcement, and no restricted fields.
 *
 * The reporting period is derived from the run id so concurrent runs on
 * the shared nonproduction database (ADR-006) land on different weeks —
 * every hours assertion can then be exact.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rpt72");

function hashCode(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

/** A Monday in 2020-2023 chosen by the run id (Mon 2020-01-06 + n weeks). */
const anchorMonday = new Date(Date.UTC(2020, 0, 6 + (hashCode(runId) % 200) * 7));

function mondayPlusWeeks(weeks: number): Date {
  const date = new Date(anchorMonday);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe.skipIf(!hasDatabase)("approved hours by funding source (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/reporting-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let grantAdminId: string;
  let coordinatorId: string;
  let managerId: string;
  let participantUserId: string;
  let sourceAId: string;
  let sourceBId: string;

  const rangeFrom = () => iso(mondayPlusWeeks(0));
  const rangeTo = () => iso(mondayPlusWeeks(1));

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
    service = await import("@/server/services/reporting-service");
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
        sites: {
          create: [
            {
              name: testScopedName(runId, "Main Site"),
              city: "Denver",
              region: "CO",
              capacity: 6,
            },
          ],
        },
      },
      include: { sites: true },
    });

    const grantAdmin = await prisma.user.create({
      data: {
        email: `${runId}-ga@synthetic.example`,
        displayName: testScopedName(runId, "Grant Admin"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.GRANT_ADMINISTRATOR },
        },
      },
    });
    grantAdminId = grantAdmin.id;
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
    const manager = await prisma.user.create({
      data: {
        email: `${runId}-mgr@synthetic.example`,
        displayName: testScopedName(runId, "Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    managerId = manager.id;

    const sourceA = await prisma.fundingSource.create({
      data: {
        name: testScopedName(runId, "Alder Grant"),
        kind: enums.FundingSourceKind.GRANT,
        code: `AWD-${runId.slice(-6).toUpperCase()}`,
      },
    });
    sourceAId = sourceA.id;
    const sourceB = await prisma.fundingSource.create({
      data: {
        name: testScopedName(runId, "Birch Contract"),
        kind: enums.FundingSourceKind.CONTRACT,
      },
    });
    sourceBId = sourceB.id;

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    let participantIndex = 0;
    async function createPlacement(fundingSourceId: string | null) {
      participantIndex += 1;
      const tag = `p${participantIndex}`;
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Hours",
              legalLastName: testScopedName(runId, tag),
              dateOfBirth: new Date("1990-01-01T00:00:00Z"),
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
        },
      });
      const participant = await prisma.participant.create({ data: { personId: person.id } });
      const enrollment = await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId: program.id,
          applicationId: application.id,
          status: enums.EnrollmentStatus.READY_FOR_MATCHING,
        },
      });
      const sourceMatch = await prisma.placementMatch.create({
        data: {
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          status: enums.MatchStatus.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-6).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus.ACTIVE,
          startDate: new Date("2026-06-01T00:00:00Z"),
        },
      });
      if (fundingSourceId) {
        await prisma.fundingAssignment.create({
          data: {
            placementId: placement.id,
            fundingSourceId,
            startDate: new Date("2026-06-01T00:00:00Z"),
            assignedByUserId: grantAdmin.id,
          },
        });
      }
      return { placementId: placement.id, userId: user.id };
    }

    const p1 = await createPlacement(sourceA.id);
    participantUserId = p1.userId;
    const p2 = await createPlacement(sourceA.id);
    const p3 = await createPlacement(sourceB.id);
    const p4 = await createPlacement(null);

    async function createTimesheet(
      placementId: string,
      weekOffset: number,
      status: "LOCKED" | "APPROVED" | "SUBMITTED",
      totalHours: string,
    ) {
      const weekStart = mondayPlusWeeks(weekOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      await prisma.timesheet.create({
        data: {
          placementId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          status: enums.TimesheetStatus[status],
          totalHours,
        },
      });
    }

    // In range (weeks 0 and 1) ...
    await createTimesheet(p1.placementId, 0, "LOCKED", "15.50");
    await createTimesheet(p1.placementId, 1, "APPROVED", "8.25");
    await createTimesheet(p2.placementId, 0, "LOCKED", "7.75");
    await createTimesheet(p3.placementId, 1, "LOCKED", "10.00");
    await createTimesheet(p4.placementId, 0, "LOCKED", "5.25");
    // ... excluded by status ...
    await createTimesheet(p2.placementId, 1, "SUBMITTED", "6.00");
    // ... and excluded by Monday attribution (weeks -1 and 2).
    await createTimesheet(p1.placementId, -1, "LOCKED", "99.99");
    await createTimesheet(p1.placementId, 2, "LOCKED", "50.00");
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.timesheet.deleteMany({ where: byParticipantUser });
    await prisma.fundingAssignment.deleteMany({ where: byParticipantUser });
    await prisma.fundingSource.deleteMany({ where: { name: { contains: runId } } });
    await prisma.placement.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.programEnrollment.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.participant.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.application.deleteMany({ where: { person: { user: { email: emails } } } });
    await prisma.person.deleteMany({ where: { user: { email: emails } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
  });

  it("sums exact Decimal totals per funding source with LOCKED and APPROVED never blended (AC1/AC3)", async () => {
    const ctx = await contextFor(grantAdminId);
    const view = await service.getApprovedHoursByFundingSource(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });

    const groupA = view.groups.find((g) => g.fundingSourceId === sourceAId);
    expect(groupA).toMatchObject({
      lockedHours: "23.25",
      approvedHours: "8.25",
      lockedTimesheetCount: 2,
      approvedTimesheetCount: 1,
      placementCount: 2,
      kindLabel: "Grant",
      code: `AWD-${runId.slice(-6).toUpperCase()}`,
    });

    const groupB = view.groups.find((g) => g.fundingSourceId === sourceBId);
    expect(groupB).toMatchObject({
      lockedHours: "10.00",
      approvedHours: "0.00",
      kindLabel: "Contract",
      code: null,
    });
  });

  it("attributes each week to the period containing its Monday (ADR-020) and excludes non-finalized statuses", async () => {
    const ctx = await contextFor(grantAdminId);

    // The out-of-range weeks (99.99 before, 50.00 after) never appear —
    // group A's exact totals above already prove it; the prior week alone:
    const priorWeek = await service.getApprovedHoursByFundingSource(ctx, {
      from: iso(mondayPlusWeeks(-1)),
      to: iso(mondayPlusWeeks(-1)),
    });
    expect(priorWeek.groups.find((g) => g.fundingSourceId === sourceAId)).toMatchObject({
      lockedHours: "99.99",
      approvedHours: "0.00",
    });

    // The SUBMITTED 6.00 week never contributes to any group of ours.
    const inRange = await service.getApprovedHoursByFundingSource(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });
    const ourGroups = [sourceAId, sourceBId];
    for (const group of inRange.groups.filter((g) =>
      ourGroups.includes(g.fundingSourceId ?? ""),
    )) {
      expect(group.lockedHours).not.toBe("6.00");
    }
  });

  it("rolls placements without an active assignment into the visible unassigned bucket", async () => {
    const ctx = await contextFor(grantAdminId);
    const view = await service.getApprovedHoursByFundingSource(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });

    const unassigned = view.groups.find((g) => g.fundingSourceId === null);
    expect(unassigned).toBeDefined();
    expect(unassigned?.name).toBe(service.NO_FUNDING_ASSIGNED_LABEL);
    expect(unassigned?.lockedHours).toBe("5.25");
    // The unassigned bucket renders last, after named sources.
    expect(view.groups[view.groups.length - 1].fundingSourceId).toBeNull();
  });

  it("permits Program Coordinators (reporting.view + Nova scope)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getApprovedHoursByFundingSource(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });
    expect(view.groups.find((g) => g.fundingSourceId === sourceAId)).toBeDefined();
  });

  it("denies org-scoped and unpermitted viewers — funding reach is Nova-only", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    // The Shelter Manager HOLDS reporting.view (7.1) — Nova scope is what fails.
    const managerCtx = await contextFor(managerId);
    await expect(
      service.getApprovedHoursByFundingSource(managerCtx, {
        from: rangeFrom(),
        to: rangeTo(),
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const participantCtx = await contextFor(participantUserId);
    await expect(
      service.getApprovedHoursByFundingSource(participantCtx, {}),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("contains no restricted fields or per-participant identifiers (AC4)", async () => {
    const ctx = await contextFor(grantAdminId);
    const view = await service.getApprovedHoursByFundingSource(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });
    const payload = JSON.stringify(view);

    expect(payload).not.toMatch(/background/i);
    expect(payload).not.toMatch(/caseNote/i);
    expect(payload).not.toMatch(/dateOfBirth|governmentId|\bssn\b/i);
    // Aggregate-only: no participant names leak into the funding rollup.
    expect(payload).not.toMatch(/legalFirstName|legalLastName|participantName/);
  });

  it("falls back to the default period on invalid ranges instead of erroring", async () => {
    const ctx = await contextFor(grantAdminId);
    const view = await service.getApprovedHoursByFundingSource(ctx, {
      from: "not-a-date",
      to: "2026-06-31",
    });
    expect(view.range.fromParams).toBe(false);
  });
});
