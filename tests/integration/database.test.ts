import { describe, expect, it } from "vitest";

/**
 * Database connectivity (Story 1.3). Runs against the shared nonproduction
 * Neon database (ADR-006) and is skipped when DATABASE_URL is not configured,
 * so the suite stays green on machines without database access.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("database connectivity", () => {
  it("executes SELECT 1 against the configured database", async () => {
    const { prisma } = await import("@/server/database/prisma");
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(Number(Object.values(result[0])[0])).toBe(1);
    await prisma.$disconnect();
  });
});

describe.skipIf(hasDatabase)("database connectivity (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
