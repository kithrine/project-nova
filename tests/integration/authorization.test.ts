import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Authorization against real memberships (Story 1.5). Contexts are built
 * exactly the way the server builds them (ACTIVE memberships from the
 * database), then run through authorizeOperation with real resource loads.
 * Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("authz15");

describe.skipIf(!hasDatabase)("authorization (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let authorize: typeof import("@/server/auth/authorize");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let orgA: string; // HOST, shelter user belongs here
  let orgB: string; // HOST, nobody from this run belongs here
  let orgNova: string; // NOVA
  let orgInactive: string; // HOST, INACTIVE — lifecycle sample
  let shelterUserId: string;
  let novaUserId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  function summaryOperation(ctx: Awaited<ReturnType<typeof contextFor>>, orgId: string) {
    return authorize.authorizeOperation({
      ctx,
      permission: "organization.view",
      loadResource: () => prisma.organization.findUnique({ where: { id: orgId } }),
      resourceOrganizationId: (org) => org.id,
      lifecycle: (org) => ({ current: org.status, allowed: ["ACTIVE"] }),
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    authorize = await import("@/server/auth/authorize");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const { Role, OrganizationKind, ActiveStatus } = enums;

    const [a, b, nova, inactive] = await Promise.all(
      [
        { name: "Org A", kind: OrganizationKind.HOST, status: ActiveStatus.ACTIVE },
        { name: "Org B", kind: OrganizationKind.HOST, status: ActiveStatus.ACTIVE },
        { name: "Org Nova", kind: OrganizationKind.NOVA, status: ActiveStatus.ACTIVE },
        { name: "Org Closed", kind: OrganizationKind.HOST, status: ActiveStatus.INACTIVE },
      ].map((data) =>
        prisma.organization.create({
          data: { ...data, name: testScopedName(runId, data.name), isSynthetic: true },
        }),
      ),
    );
    orgA = a.id;
    orgB = b.id;
    orgNova = nova.id;
    orgInactive = inactive.id;

    const shelterUser = await prisma.user.create({
      data: {
        email: `${runId}-shelter@synthetic.example`,
        displayName: testScopedName(runId, "Shelter User"),
        isSynthetic: true,
        memberships: { create: { organizationId: orgA, role: Role.SHELTER_SUPERVISOR } },
      },
    });
    const novaUser = await prisma.user.create({
      data: {
        email: `${runId}-nova@synthetic.example`,
        displayName: testScopedName(runId, "Nova User"),
        isSynthetic: true,
        memberships: { create: { organizationId: orgNova, role: Role.PROGRAM_COORDINATOR } },
      },
    });
    shelterUserId = shelterUser.id;
    novaUserId = novaUser.id;
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("allows a shelter user to reach their own organization", async () => {
    const ctx = await contextFor(shelterUserId);
    const org = await summaryOperation(ctx, orgA);
    expect(org.id).toBe(orgA);
  });

  it("denies a shelter user another organization's resource (cross-org)", async () => {
    const ctx = await contextFor(shelterUserId);
    await expect(summaryOperation(ctx, orgB)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });

  it("grants Nova staff Nova-wide scope over host organizations", async () => {
    const ctx = await contextFor(novaUserId);
    const org = await summaryOperation(ctx, orgA);
    expect(org.id).toBe(orgA);
  });

  it("denies non-funding roles funding.manage regardless of scope", async () => {
    const ctx = await contextFor(novaUserId); // Program Coordinator
    expect(authorize.hasPermission(ctx, "funding.manage")).toBe(false);
  });

  it("gates on lifecycle: an INACTIVE organization is denied even for Nova staff", async () => {
    const ctx = await contextFor(novaUserId);
    await expect(summaryOperation(ctx, orgInactive)).rejects.toBeInstanceOf(
      errors.LifecycleError,
    );
  });

  it("stops granting access the moment a membership is deactivated", async () => {
    const before = await contextFor(shelterUserId);
    await summaryOperation(before, orgA); // passes while ACTIVE

    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: shelterUserId, organizationId: orgA },
    });
    await memberships.deactivateMembership(membership.id);

    const after = await contextFor(shelterUserId); // server re-resolves
    await expect(summaryOperation(after, orgA)).rejects.toBeInstanceOf(
      errors.AuthorizationError,
    );
  });
});

describe.skipIf(hasDatabase)("authorization (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
