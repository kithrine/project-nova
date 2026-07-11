import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Membership constraints and organization scoping (Story 1.4).
 * Runs against the shared nonproduction database (ADR-006): every row is
 * tagged with this run's id, and cleanup deletes ONLY those rows — never
 * a truncate, never an assumption the database is empty.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("m14");

describe.skipIf(!hasDatabase)("memberships (integration)", () => {
  // Imported lazily so machines without DATABASE_URL never construct a client.
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let repo: typeof import("@/server/repositories/membership-repository");
  let ActiveStatus: (typeof import("@/generated/prisma/client"))["ActiveStatus"];
  let Role: (typeof import("@/generated/prisma/client"))["Role"];
  let OrganizationKind: (typeof import("@/generated/prisma/client"))["OrganizationKind"];

  let orgId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    repo = await import("@/server/repositories/membership-repository");
    ({ ActiveStatus, Role, OrganizationKind } = await import("@/generated/prisma/client"));

    const org = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Test Shelter"),
        kind: OrganizationKind.HOST,
        isSynthetic: true,
      },
    });
    orgId = org.id;

    const userA = await prisma.user.create({
      data: {
        email: `${runId}-a@synthetic.example`,
        displayName: testScopedName(runId, "User A"),
        isSynthetic: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `${runId}-b@synthetic.example`,
        displayName: testScopedName(runId, "User B"),
        isSynthetic: true,
      },
    });
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    // Targeted cleanup: only this run's rows, children first.
    await prisma.membership.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.organization.deleteMany({
      where: { name: { contains: runId } },
    });
    await prisma.$disconnect();
  });

  it("enforces one membership per user + organization + role", async () => {
    await prisma.membership.create({
      data: { userId: userAId, organizationId: orgId, role: Role.SHELTER_SUPERVISOR },
    });

    await expect(
      prisma.membership.create({
        data: { userId: userAId, organizationId: orgId, role: Role.SHELTER_SUPERVISOR },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same user to hold a different role in the same organization", async () => {
    const second = await prisma.membership.create({
      data: { userId: userAId, organizationId: orgId, role: Role.SHELTER_MANAGER },
    });
    expect(second.status).toBe(ActiveStatus.ACTIVE);
  });

  it("preserves a deactivated membership as history and stops granting access", async () => {
    const membership = await prisma.membership.create({
      data: { userId: userBId, organizationId: orgId, role: Role.SHELTER_SUPERVISOR },
    });

    await repo.deactivateMembership(membership.id);

    // Preserved (archive-not-delete) ...
    const retained = await prisma.membership.findUnique({ where: { id: membership.id } });
    expect(retained).not.toBeNull();
    expect(retained?.status).toBe(ActiveStatus.INACTIVE);
    expect(retained?.deactivatedAt).toBeInstanceOf(Date);

    // ... but no longer part of the user's active scope.
    const active = await repo.listActiveMembershipsForUser(userBId);
    expect(active.find((m) => m.id === membership.id)).toBeUndefined();
  });

  it("scopes active memberships to the requested user only", async () => {
    const viewsA = await repo.listActiveMembershipsForUser(userAId);
    expect(viewsA.length).toBeGreaterThan(0);
    // Every returned membership belongs to this run's org (User A's only org)
    // and is ACTIVE — and none belong to User B.
    for (const view of viewsA) {
      expect(view.organizationId).toBe(orgId);
      expect(view.status).toBe(ActiveStatus.ACTIVE);
    }
    const viewsB = await repo.listActiveMembershipsForUser(userBId);
    expect(viewsB.find((m) => viewsA.some((a) => a.id === m.id))).toBeUndefined();
  });

  it("returns shaped view models, not raw Prisma records", async () => {
    const [view] = await repo.listActiveMembershipsForUser(userAId);
    expect(view).toBeDefined();
    const raw = view as unknown as Record<string, unknown>;
    expect(raw.userId).toBeUndefined();
    expect(raw.createdAt).toBeUndefined();
    expect(view.roleLabel).toBeTruthy();
    expect(view.organizationName).toContain(runId);
  });
});

describe.skipIf(hasDatabase)("memberships (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
