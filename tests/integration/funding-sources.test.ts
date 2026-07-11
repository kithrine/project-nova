import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Funding-source service against Neon (Story 1.8): permission + Nova-scope
 * enforcement, archive-not-delete, and the active-only selection list.
 * Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("fund18");

describe.skipIf(!hasDatabase)("funding sources (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/funding-source-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let grantAdminId: string;
  let coordinatorId: string;
  let shelterUserId: string;

  async function contextFor(uid: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  const input = (name: string) => ({
    name: testScopedName(runId, name),
    kind: "GRANT" as const,
    code: undefined,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    notes: undefined,
  });

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/funding-source-service");
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
    const shelter = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Shelter Org"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });

    const [ga, pc, su] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${runId}-ga@synthetic.example`,
          displayName: testScopedName(runId, "Grant Admin"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.GRANT_ADMINISTRATOR },
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `${runId}-pc@synthetic.example`,
          displayName: testScopedName(runId, "Coordinator"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `${runId}-su@synthetic.example`,
          displayName: testScopedName(runId, "Supervisor"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: shelter.id, role: enums.Role.SHELTER_SUPERVISOR },
          },
        },
      }),
    ]);
    grantAdminId = ga.id;
    coordinatorId = pc.id;
    shelterUserId = su.id;
  });

  afterAll(async () => {
    await prisma.fundingSource.deleteMany({ where: { name: { contains: runId } } });
    await prisma.membership.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("lets a Grant Administrator create, edit, and read funding sources", async () => {
    const ctx = await contextFor(grantAdminId);

    const created = await service.createFundingSource(ctx, input("Pilot Grant"));
    expect(created.statusLabel).toBe("Active");
    expect(created.startDate).toBe("2026-01-01");

    const updated = await service.updateFundingSource(ctx, created.id, {
      ...input("Pilot Grant Renamed"),
      kind: "CONTRACT",
    });
    expect(updated.name).toContain("Pilot Grant Renamed");
    expect(updated.kindLabel).toBe("Contract");

    const fetched = await service.getFundingSource(ctx, created.id);
    expect(fetched.kind).toBe("CONTRACT");
  });

  it("archives on deactivation: preserved in the full list, excluded from the active list", async () => {
    const ctx = await contextFor(grantAdminId);
    const source = await service.createFundingSource(ctx, input("Sunset Grant"));

    await service.deactivateFundingSource(ctx, source.id);

    const all = await service.listFundingSources(ctx);
    const active = await service.listActiveFundingSources(ctx);
    expect(all.find((s) => s.id === source.id)?.statusLabel).toBe("Inactive");
    expect(active.find((s) => s.id === source.id)).toBeUndefined();

    // Explicit transitions only: deactivating again is a lifecycle error.
    await expect(service.deactivateFundingSource(ctx, source.id)).rejects.toBeInstanceOf(
      errors.LifecycleError,
    );

    // Reversible: reactivation restores selectability.
    await service.reactivateFundingSource(ctx, source.id);
    const reactivated = await service.getFundingSource(ctx, source.id);
    expect(reactivated.statusLabel).toBe("Active");
  });

  it("denies a Program Coordinator (no funding.manage)", async () => {
    const ctx = await contextFor(coordinatorId);
    await expect(service.createFundingSource(ctx, input("Denied Grant"))).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
    await expect(service.listFundingSources(ctx)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });

  it("denies shelter roles entirely", async () => {
    const ctx = await contextFor(shelterUserId);
    await expect(service.listFundingSources(ctx)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });
});

describe.skipIf(hasDatabase)("funding sources (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
