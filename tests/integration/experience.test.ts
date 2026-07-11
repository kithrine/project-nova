import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Experience gating against real memberships (Story 1.7). Contexts are
 * built the way the server builds them; deactivating a membership must
 * immediately close the corresponding experience.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("exp17");

describe.skipIf(!hasDatabase)("experience access (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let experience: typeof import("@/server/auth/experience");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let orgId: string;
  let userId: string;

  async function contextFor(uid: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    experience = await import("@/server/auth/experience");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

    const org = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Gate Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `${runId}-gate@synthetic.example`,
        displayName: testScopedName(runId, "Gate User"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: org.id, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.membership.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("opens the shelter experience for an active shelter membership and closes operations", async () => {
    const ctx = await contextFor(userId);
    expect(experience.canAccessExperience(ctx, "shelter")).toBe(true);
    expect(experience.canAccessExperience(ctx, "operations")).toBe(false);
    expect(experience.routeForContext(ctx)).toBe("/shelter");
  });

  it("closes the shelter experience the moment the membership is deactivated", async () => {
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId, organizationId: orgId },
    });
    await memberships.deactivateMembership(membership.id);

    const ctx = await contextFor(userId);
    expect(experience.canAccessExperience(ctx, "shelter")).toBe(false);
    expect(experience.routeForContext(ctx)).toBe("/participant");
  });
});

describe.skipIf(hasDatabase)("experience access (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
