import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Named exports against Neon (Story 7.5; ADR-021): allow-listed CSV
 * output per export, one audit event per run (and none on denial),
 * permission + scope enforcement, and no restricted contents.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("exp75");

describe.skipIf(!hasDatabase)("named exports (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/export-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let grantAdminId: string;
  let adminId: string;
  let coordinatorId: string;
  let managerId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function auditCountFor(actorUserId: string): Promise<number> {
    return prisma.auditEvent.count({
      where: { actorUserId, action: "report.export" },
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/export-service");
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
              capacity: 4,
            },
          ],
        },
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

    grantAdminId = await createUser("GRANT_ADMINISTRATOR", nova.id, "ga");
    adminId = await createUser("NOVA_ADMINISTRATOR", nova.id, "na");
    coordinatorId = await createUser("PROGRAM_COORDINATOR", nova.id, "pc");
    managerId = await createUser("SHELTER_MANAGER", host.id, "mgr");
  });

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.auditEvent.deleteMany({
      where: { actorUserId: { in: [grantAdminId, adminId] } },
    });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
  });

  it("produces exactly the allow-listed header row for every named export (AC1)", async () => {
    const ctx = await contextFor(grantAdminId);

    for (const definition of service.EXPORT_DEFINITIONS) {
      const result = await service.runNamedExport(ctx, definition.key);
      const headerLine = result.csv.split("\r\n")[0];
      expect(headerLine, definition.key).toBe(definition.columns.join(","));
      expect(result.fileName).toMatch(
        new RegExp(`^nova-${definition.key}-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
      );
    }
  });

  it("writes one audit event per export run with actor, name, and scope (AC2)", async () => {
    const ctx = await contextFor(adminId);
    const before = await auditCountFor(adminId);

    await service.runNamedExport(ctx, "outcome-summary", {
      from: "2026-02-01",
      to: "2026-02-28",
    });

    expect(await auditCountFor(adminId)).toBe(before + 1);
    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { actorUserId: adminId, action: "report.export" },
      orderBy: { createdAt: "desc" },
    });
    expect(event.subjectType).toBe("Export");
    expect(event.subjectId).toBe("outcome-summary");
    expect(event.detail).toBe("Outcome summary (2026-02-01 to 2026-02-28)");
  });

  it("contains no restricted contents in any export output (AC3)", async () => {
    const ctx = await contextFor(grantAdminId);

    for (const definition of service.EXPORT_DEFINITIONS) {
      const result = await service.runNamedExport(ctx, definition.key);
      expect(result.csv, definition.key).not.toMatch(/background/i);
      expect(result.csv, definition.key).not.toMatch(/case ?note/i);
      expect(result.csv, definition.key).not.toMatch(/narrative/i);
      expect(result.csv, definition.key).not.toMatch(/dateOfBirth|governmentId|\bssn\b/i);
    }
  });

  it("denies unpermitted and out-of-scope callers and produces neither file nor audit event (AC4)", async () => {
    const { AuthorizationError } = await import("@/server/errors/app-error");

    for (const userId of [coordinatorId, managerId]) {
      const ctx = await contextFor(userId);
      const before = await auditCountFor(userId);
      await expect(
        service.runNamedExport(ctx, "active-placements"),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(await auditCountFor(userId)).toBe(before);
    }
  });

  it("rejects unknown export names without writing anything", async () => {
    const { NotFoundError } = await import("@/server/errors/app-error");
    const ctx = await contextFor(grantAdminId);
    const before = await auditCountFor(grantAdminId);
    await expect(service.runNamedExport(ctx, "everything")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await auditCountFor(grantAdminId)).toBe(before);
  });
});
