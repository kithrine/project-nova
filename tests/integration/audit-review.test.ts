import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Audit review against Neon (Story 7.6): privileged read over the
 * append-only trail — filter narrowing, permission + scope gating, the
 * no-mutation module shape (AC5), and reference-only rows (AC4).
 *
 * The trail is global on the shared nonproduction database (ADR-006),
 * so every assertion filters down to this run's own actor or subject
 * ids — exactness without assuming an empty table.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("aud76");

describe.skipIf(!hasDatabase)("audit review (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/audit-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let adminId: string;
  let grantAdminId: string;
  let coordinatorId: string;
  let managerId: string;

  const subjectA = `${runId}-subject-a`;
  const subjectB = `${runId}-subject-b`;

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
    service = await import("@/server/services/audit-service");
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

    adminId = await createUser("NOVA_ADMINISTRATOR", nova.id, "na");
    grantAdminId = await createUser("GRANT_ADMINISTRATOR", nova.id, "ga");
    coordinatorId = await createUser("PROGRAM_COORDINATOR", nova.id, "pc");
    managerId = await createUser("SHELTER_MANAGER", host.id, "mgr");

    // Three events by two actors across two subject types.
    await prisma.auditEvent.createMany({
      data: [
        {
          actorUserId: adminId,
          action: "backgroundReview.view",
          subjectType: "Application",
          subjectId: subjectA,
        },
        {
          actorUserId: adminId,
          action: "timesheet.lock",
          subjectType: "Timesheet",
          subjectId: subjectB,
          detail: "final for reporting: 9.75 hours",
        },
        {
          actorUserId: grantAdminId,
          action: "timesheet.lock",
          subjectType: "Timesheet",
          subjectId: subjectA,
          detail: "final for reporting: 4.00 hours",
        },
      ],
    });
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    // ADR-006 targeted cleanup of this run's synthetic rows. The
    // append-only rule is an APPLICATION invariant — the app exposes no
    // deletion path — not a bar on test-fixture hygiene.
    await prisma.auditEvent.deleteMany({ where: { subjectId: { startsWith: runId } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
  });

  it("lists events with actor, action, resource reference, and timestamp (AC1)", async () => {
    const ctx = await contextFor(adminId);
    const view = await service.listAuditEvents(ctx, {});

    const ours = view.rows.filter((row) => row.subjectId.startsWith(runId));
    expect(ours.length).toBeGreaterThanOrEqual(3);
    const lock = ours.find((row) => row.detail === "final for reporting: 9.75 hours");
    expect(lock).toMatchObject({
      action: "timesheet.lock",
      subjectType: "Timesheet",
      subjectId: subjectB,
    });
    expect(lock!.actorName).toContain(runId);
    expect(lock!.atLabel).toMatch(/\d{4}/);
  });

  it("narrows by actor, action, resource type, and date (AC2)", async () => {
    const ctx = await contextFor(adminId);

    const byActor = await service.listAuditEvents(ctx, { actorUserId: grantAdminId });
    expect(byActor.rows.every((row) => row.actorName.includes(runId))).toBe(true);
    expect(byActor.rows).toHaveLength(1);
    expect(byActor.totalCount).toBe(1);
    expect(byActor.rows[0].subjectId).toBe(subjectA);

    const byActorAndAction = await service.listAuditEvents(ctx, {
      actorUserId: adminId,
      action: "timesheet.lock",
    });
    expect(byActorAndAction.totalCount).toBe(1);
    expect(byActorAndAction.rows[0].subjectId).toBe(subjectB);

    const byActorAndType = await service.listAuditEvents(ctx, {
      actorUserId: adminId,
      subjectType: "Application",
    });
    expect(byActorAndType.totalCount).toBe(1);
    expect(byActorAndType.rows[0].action).toBe("backgroundReview.view");

    // A date window fully in the past excludes today's events.
    const past = await service.listAuditEvents(ctx, {
      actorUserId: adminId,
      from: "2020-01-01",
      to: "2020-01-31",
    });
    expect(past.totalCount).toBe(0);
  });

  it("permits the Grant Administrator and denies everyone else (AC3)", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    const grantCtx = await contextFor(grantAdminId);
    const view = await service.listAuditEvents(grantCtx, { actorUserId: adminId });
    expect(view.totalCount).toBe(2);

    // Even the Program Coordinator — an operations user — is denied:
    // reading the trail is its own restricted privilege.
    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(service.listAuditEvents(coordinatorCtx, {})).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    const managerCtx = await contextFor(managerId);
    await expect(service.listAuditEvents(managerCtx, {})).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("exposes references and non-sensitive detail only (AC4)", async () => {
    const ctx = await contextFor(adminId);
    const view = await service.listAuditEvents(ctx, { actorUserId: adminId });
    const payload = JSON.stringify(view);

    // Row shape is fixed: reference fields plus the 2.7-constrained detail.
    expect(Object.keys(view.rows[0]).sort()).toEqual([
      "action",
      "actorName",
      "atIso",
      "atLabel",
      "detail",
      "id",
      "subjectId",
      "subjectType",
    ]);
    expect(payload).not.toMatch(/legalFirstName|legalLastName|dateOfBirth/);
    expect(payload).not.toMatch(/rationale|narrative/i);
  });

  it("offers no update or delete path — the module is append-and-read only (AC5)", async () => {
    const mutators = Object.keys(service).filter((name) =>
      /delete|remove|update|purge|clear/i.test(name),
    );
    expect(mutators).toEqual([]);

    // Reading the trail never mutates it.
    const ctx = await contextFor(adminId);
    const before = await prisma.auditEvent.count({
      where: { subjectId: { startsWith: runId } },
    });
    await service.listAuditEvents(ctx, {});
    const after = await prisma.auditEvent.count({
      where: { subjectId: { startsWith: runId } },
    });
    expect(after).toBe(before);
    expect(before).toBe(3);
  });
});
