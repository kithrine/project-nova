import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Outcome summary against Neon (Story 7.4): terminal-outcome counting,
 * endDate range scoping, certification counting by issuedOn, Nova-scope
 * enforcement, and an aggregates-only payload.
 *
 * Counts are global per range on the shared nonproduction database
 * (ADR-006), so the reporting period is derived from the run id — a
 * month in 2019–2022 no other suite writes to — keeping every count
 * assertion exact.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("rpt74");

function hashCode(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

const anchorYear = 2019 + (hashCode(runId) % 4);
const anchorMonth = hashCode(`${runId}-m`) % 12;

function anchorDate(day: number): Date {
  return new Date(Date.UTC(anchorYear, anchorMonth, day));
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const rangeFrom = () => iso(anchorDate(1));
const rangeTo = () => iso(new Date(Date.UTC(anchorYear, anchorMonth + 1, 0)));

describe.skipIf(!hasDatabase)("outcome summary (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/reporting-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let managerId: string;
  let participantUserId: string;

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
              capacity: 8,
            },
          ],
        },
      },
      include: { sites: true },
    });

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

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    let participantIndex = 0;
    async function createPlacement(
      status: keyof typeof enums.PlacementStatus,
      endDate: Date | null,
    ) {
      participantIndex += 1;
      const tag = `p${participantIndex}`;
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: "Outcome",
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
      await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-6).toUpperCase()}-${tag.toUpperCase()}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: sourceMatch.id,
          status: enums.PlacementStatus[status],
          startDate: anchorDate(1),
          endDate,
        },
      });
      return { participantId: participant.id, userId: user.id };
    }

    // In the anchor month: 1 completed, 1 converted, 1 withdrawn, 2 terminated.
    const completed = await createPlacement("COMPLETED", anchorDate(5));
    participantUserId = completed.userId;
    await createPlacement("CONVERTED_TO_PERMANENT", anchorDate(10));
    await createPlacement("WITHDRAWN", anchorDate(15));
    await createPlacement("TERMINATED", anchorDate(12));
    await createPlacement("TERMINATED", anchorDate(20));
    // Outside the range: same terminal status, previous month.
    await createPlacement("COMPLETED", new Date(Date.UTC(anchorYear, anchorMonth - 1, 20)));
    // Never counted: in-progress placement with no end date.
    await createPlacement("ACTIVE", null);

    // Certifications: two issued in the anchor month, one outside.
    await prisma.certification.createMany({
      data: [
        {
          participantId: completed.participantId,
          name: testScopedName(runId, "Animal Care Basics"),
          issuer: "Nova Training",
          issuedOn: anchorDate(6),
        },
        {
          participantId: completed.participantId,
          name: testScopedName(runId, "Safe Handling"),
          issuer: "Nova Training",
          issuedOn: anchorDate(18),
        },
        {
          participantId: completed.participantId,
          name: testScopedName(runId, "Earlier Credential"),
          issuer: "Nova Training",
          issuedOn: new Date(Date.UTC(anchorYear, anchorMonth - 1, 15)),
        },
      ],
    });
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.certification.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
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

  it("counts each terminal outcome within the range, zero-filled and exact (AC1/AC5)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getOutcomeSummary(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });

    const byStatus = new Map(view.outcomes.map((o) => [o.status, o]));
    expect(byStatus.get(enums.PlacementStatus.COMPLETED)).toMatchObject({
      label: "Completed",
      count: 1,
    });
    expect(byStatus.get(enums.PlacementStatus.CONVERTED_TO_PERMANENT)).toMatchObject({
      label: "Converted to permanent employment",
      count: 1,
    });
    expect(byStatus.get(enums.PlacementStatus.WITHDRAWN)).toMatchObject({ count: 1 });
    expect(byStatus.get(enums.PlacementStatus.TERMINATED)).toMatchObject({ count: 2 });
    expect(view.totalOutcomes).toBe(5);
    // The out-of-range COMPLETED and the ACTIVE placement never count.
  });

  it("counts certifications by issuedOn within the range (AC2)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getOutcomeSummary(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });
    expect(view.certificationsEarned).toBe(2);
  });

  it("defaults to program-to-date and includes at least the ranged rows", async () => {
    const ctx = await contextFor(coordinatorId);
    const cumulative = await service.getOutcomeSummary(ctx, {});
    expect(cumulative.range).toBeNull();

    const completed = cumulative.outcomes.find(
      (o) => o.status === enums.PlacementStatus.COMPLETED,
    );
    // Cumulative counts are global on the shared database — assert ours
    // are included (both COMPLETED placements), never an exact total.
    expect(completed!.count).toBeGreaterThanOrEqual(2);
    expect(cumulative.certificationsEarned).toBeGreaterThanOrEqual(3);
  });

  it("denies org-scoped and unpermitted viewers — impact reach is Nova-only", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    const managerCtx = await contextFor(managerId);
    await expect(service.getOutcomeSummary(managerCtx, {})).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    const participantCtx = await contextFor(participantUserId);
    await expect(service.getOutcomeSummary(participantCtx, {})).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("returns aggregates only — no participant identifiers or restricted fields (AC4)", async () => {
    const ctx = await contextFor(coordinatorId);
    const view = await service.getOutcomeSummary(ctx, {
      from: rangeFrom(),
      to: rangeTo(),
    });
    const payload = JSON.stringify(view);

    expect(payload).not.toMatch(/legalFirstName|legalLastName|participantName|email/);
    expect(payload).not.toMatch(/background/i);
    expect(payload).not.toMatch(/caseNote/i);
    expect(payload).not.toMatch(/dateOfBirth|governmentId|\bssn\b/i);
    // Nothing but numbers, labels, and the range echo.
    expect(Object.keys(view).sort()).toEqual([
      "certificationsEarned",
      "outcomes",
      "range",
      "totalOutcomes",
    ]);
  });
});
