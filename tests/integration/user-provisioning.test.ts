import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId } from "../helpers/test-run";

/**
 * Clerk user provisioning against the shared nonproduction database
 * (Story 1.2, ADR-006). Rows are tagged with this run's id; cleanup
 * targets only those rows.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("prov12");

describe.skipIf(!hasDatabase)("provisionClerkUser (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let provision: typeof import("@/server/services/user-provisioning");

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    provision = await import("@/server/services/user-provisioning");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: `${runId}-` } },
          { clerkUserId: { startsWith: `clerk_${runId}` } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  it("creates exactly one user and replays idempotently", async () => {
    const data = {
      clerkUserId: `clerk_${runId}_a`,
      email: `${runId}-a@synthetic.example`,
      displayName: "Provisioned User A",
    };

    const first = await provision.provisionClerkUser(data);
    expect(first.created).toBe(true);

    const replay = await provision.provisionClerkUser(data);
    expect(replay.created).toBe(false);
    expect(replay.userId).toBe(first.userId);

    const rows = await prisma.user.findMany({ where: { clerkUserId: data.clerkUserId } });
    expect(rows).toHaveLength(1);
  });

  it("keeps email and display name in sync on updated events", async () => {
    const clerkUserId = `clerk_${runId}_b`;
    await provision.provisionClerkUser({
      clerkUserId,
      email: `${runId}-b@synthetic.example`,
      displayName: "Before Rename",
    });

    const updated = await provision.provisionClerkUser({
      clerkUserId,
      email: `${runId}-b-new@synthetic.example`,
      displayName: "After Rename",
    });
    expect(updated.created).toBe(false);

    const row = await prisma.user.findUnique({ where: { clerkUserId } });
    expect(row?.email).toBe(`${runId}-b-new@synthetic.example`);
    expect(row?.displayName).toBe("After Rename");
  });

  it("links a pre-existing user (no Clerk identity) by email on first sign-in", async () => {
    const preexisting = await prisma.user.create({
      data: {
        email: `${runId}-c@synthetic.example`,
        displayName: "Pre-provisioned",
        isSynthetic: true,
      },
    });
    expect(preexisting.clerkUserId).toBeNull();

    const result = await provision.provisionClerkUser({
      clerkUserId: `clerk_${runId}_c`,
      email: `${runId}-c@synthetic.example`,
      displayName: "Linked User",
    });

    expect(result.created).toBe(false);
    expect(result.userId).toBe(preexisting.id);

    const row = await prisma.user.findUnique({ where: { id: preexisting.id } });
    expect(row?.clerkUserId).toBe(`clerk_${runId}_c`);
  });
});

describe.skipIf(hasDatabase)("provisionClerkUser (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
