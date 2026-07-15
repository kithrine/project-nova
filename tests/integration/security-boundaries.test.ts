import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Security boundary battery (Story 7.8; docs/architecture/testing-strategy.md).
 * Consolidates the launch-gating proofs in one place:
 *   AC1 — cross-organization denial across placements, timesheets,
 *         incidents, and applications;
 *   AC2 — no client-trusted claims: authorization derives ONLY from
 *         server-resolved ACTIVE memberships (a deactivated membership
 *         grants nothing), and requested filters never widen scope;
 *   AC3 — shelters cannot reach raw applications, background details,
 *         or internal case notes — structurally absent, not hidden;
 *   AC4 — lifecycle gating denies permitted, in-scope actors when the
 *         record's state forbids the action.
 * The deny-by-default permission sweeps live in permissions.test.ts; the
 * webhook signature rejection and the cross-shelter journey are in
 * tests/e2e/security.spec.ts.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("sec78");

describe.skipIf(!hasDatabase)("security boundaries (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let placements: typeof import("@/server/services/placement-service");
  let timesheets: typeof import("@/server/services/timesheet-service");
  let applications: typeof import("@/server/services/application-review-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let managerAId: string;
  let managerBId: string;
  let supervisorAId: string;
  let coordinatorId: string;

  let placementAId: string;
  let applicationAId: string;
  let submittedTimesheetId: string;
  let draftTimesheetId: string;

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
    applications = await import("@/server/services/application-review-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const orgA = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Shelter A"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: { create: [{ name: testScopedName(runId, "Site A"), capacity: 4 }] },
      },
      include: { sites: true },
    });
    const orgB = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Shelter B"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });

    async function createUser(role: keyof typeof enums.Role, orgId: string, tag: string) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${tag}@synthetic.example`,
          displayName: testScopedName(runId, tag),
          isSynthetic: true,
          memberships: { create: { organizationId: orgId, role: enums.Role[role] } },
        },
      });
      return user.id;
    }

    managerAId = await createUser("SHELTER_MANAGER", orgA.id, "mgr-a");
    managerBId = await createUser("SHELTER_MANAGER", orgB.id, "mgr-b");
    supervisorAId = await createUser("SHELTER_SUPERVISOR", orgA.id, "sup-a");
    coordinatorId = await createUser("PROGRAM_COORDINATOR", nova.id, "pc");

    // Org A's participant with an application, ACTIVE placement (with an
    // internal case note and an incident), a SUBMITTED week, and a DRAFT
    // week — the full sensitive surface the boundaries protect.
    const participantUser = await prisma.user.create({
      data: {
        email: `${runId}-part@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Boundary",
            legalLastName: testScopedName(runId, "Case"),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    const person = await prisma.person.findUniqueOrThrow({
      where: { userId: participantUser.id },
    });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-6).toUpperCase()}`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    applicationAId = application.id;
    await prisma.caseNote.create({
      data: {
        applicationId: application.id,
        authorUserId: coordinatorId,
        body: `${runId} internal case note — never for shelters`,
      },
    });

    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
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
        hostOrganizationId: orgA.id,
        organizationSiteId: orgA.sites[0].id,
        status: enums.MatchStatus.APPROVED,
      },
    });
    const placement = await prisma.placement.create({
      data: {
        placementNumber: `PLC-${runId.slice(-6).toUpperCase()}`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: orgA.id,
        organizationSiteId: orgA.sites[0].id,
        sourceMatchId: match.id,
        status: enums.PlacementStatus.ACTIVE,
        supervisorId: supervisorAId,
        startDate: new Date("2026-06-01T00:00:00Z"),
      },
    });
    placementAId = placement.id;
    await prisma.incident.create({
      data: {
        incidentNumber: `INC-${runId.slice(-6).toUpperCase()}`,
        placementId: placement.id,
        reporterUserId: supervisorAId,
        category: enums.IncidentCategory.SAFETY,
        severity: enums.IncidentSeverity.MINOR,
        occurredOn: new Date("2026-07-01T00:00:00.000Z"),
        description: `${runId} incident description`,
      },
    });

    async function createTimesheet(weekStartIso: string, status: "SUBMITTED" | "DRAFT") {
      const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const row = await prisma.timesheet.create({
        data: {
          placementId: placement.id,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          status: enums.TimesheetStatus[status],
          totalHours: "8.00",
          submittedAt: status === "SUBMITTED" ? new Date() : null,
        },
      });
      return row.id;
    }
    submittedTimesheetId = await createTimesheet("2026-06-01", "SUBMITTED");
    draftTimesheetId = await createTimesheet("2026-06-08", "DRAFT");
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.workEntry.deleteMany({
      where: { timesheet: { placement: { participant: { person: { user: { email: emails } } } } } },
    });
    await prisma.timesheetEvent.deleteMany({
      where: { timesheet: { placement: { participant: { person: { user: { email: emails } } } } } },
    });
    await prisma.timesheet.deleteMany({
      where: { placement: { participant: { person: { user: { email: emails } } } } },
    });
    await prisma.incidentFollowUp.deleteMany({
      where: { incident: { incidentNumber: { contains: runId.slice(-6).toUpperCase() } } },
    });
    await prisma.incident.deleteMany({
      where: { placement: { participant: { person: { user: { email: emails } } } } },
    });
    await prisma.caseNoteRevision.deleteMany({
      where: { caseNote: { application: { person: { user: { email: emails } } } } },
    });
    await prisma.caseNote.deleteMany({
      where: { application: { person: { user: { email: emails } } } },
    });
    await prisma.placementEvent.deleteMany({
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

  it("denies organization B's manager across placements, timesheets, and their incident surface (AC1)", async () => {
    const managerB = await contextFor(managerBId);

    // The placement workspace carries the incidents tab — one denial
    // proves the whole surface unreachable cross-org.
    await expect(
      placements.getPlacementWorkspace(managerB, placementAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);

    await expect(
      timesheets.getTimesheetReview(managerB, submittedTimesheetId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
    await expect(
      timesheets.approveTimesheet(managerB, submittedTimesheetId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);

    // Sanity: the same reads succeed for organization A's manager.
    const own = await placements.getPlacementWorkspace(
      await contextFor(managerAId),
      placementAId,
    );
    expect(own).toBeTruthy();
  });

  it("keeps raw applications, background details, and case notes unreachable for shelter roles (AC1/AC3)", async () => {
    const managerA = await contextFor(managerAId);

    // Even the HOSTING organization's manager never reads the raw
    // application or its background surface.
    await expect(
      applications.getApplicationWorkspace(managerA, applicationAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
    await expect(
      applications.getBackgroundReview(managerA, applicationAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
    await expect(
      applications.listCaseNotes(managerA, applicationAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);

    // Background is restricted beyond ordinary Nova operations too.
    const coordinator = await contextFor(coordinatorId);
    await expect(
      applications.getBackgroundReview(coordinator, applicationAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);

    // And the shelter's own placement workspace is SHAPED without the
    // sensitive fields — absent from the payload, not hidden by the UI.
    const shelterView = await placements.getPlacementWorkspace(managerA, placementAId);
    const payload = JSON.stringify(shelterView);
    expect(payload).not.toMatch(/caseNote/i);
    expect(payload).not.toMatch(/background/i);
    expect(payload).not.toMatch(/never for shelters/);
  });

  it("derives authorization from ACTIVE server-side memberships only — deactivation revokes everything (AC2)", async () => {
    // Manager A can read their org's placement today...
    const before = await contextFor(managerAId);
    await expect(
      placements.getPlacementWorkspace(before, placementAId),
    ).resolves.toBeTruthy();

    // ...their membership is deactivated (departure)...
    await prisma.membership.updateMany({
      where: { userId: managerAId },
      data: { status: enums.ActiveStatus.INACTIVE, deactivatedAt: new Date() },
    });

    // ...and a context resolved AFTER deactivation carries no grants: the
    // server re-derives claims from the database on every request, so
    // there is nothing client-side to forge or replay.
    const after = await contextFor(managerAId);
    expect(after.memberships).toHaveLength(0);
    await expect(
      placements.getPlacementWorkspace(after, placementAId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
    await expect(
      timesheets.getTimesheetReview(after, submittedTimesheetId),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);

    // Restore for the remaining tests.
    await prisma.membership.updateMany({
      where: { userId: managerAId },
      data: { status: enums.ActiveStatus.ACTIVE, deactivatedAt: null },
    });
  });

  it("denies lifecycle-forbidden actions to permitted, in-scope actors (AC4)", async () => {
    const supervisorA = await contextFor(supervisorAId);

    // The assigned supervisor holds timesheet.approve and org scope — the
    // DRAFT status alone forbids the action.
    await expect(
      timesheets.approveTimesheet(supervisorA, draftTimesheetId),
    ).rejects.toBeInstanceOf(errors.LifecycleError);

    // The coordinator holds timesheet.lock under Nova scope — SUBMITTED
    // (not yet approved) forbids locking.
    const coordinator = await contextFor(coordinatorId);
    await expect(
      timesheets.lockTimesheet(coordinator, submittedTimesheetId),
    ).rejects.toBeInstanceOf(errors.LifecycleError);
  });

  it("keeps authorization errors generic — no resource contents in the message", async () => {
    const managerB = await contextFor(managerBId);
    const failure = await placements
      .getPlacementWorkspace(managerB, placementAId)
      .then(() => null)
      .catch((error: Error) => error);

    expect(failure).toBeInstanceOf(errors.AuthorizationError);
    expect(failure!.message).not.toMatch(new RegExp(runId));
    expect(failure!.message).not.toMatch(/Boundary|Case|PLC-/);
  });
});
