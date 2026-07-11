import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton (Prisma 7 driver-adapter architecture).
 *
 * The pg adapter opens a lazy connection pool against DATABASE_URL —
 * the shared nonproduction Neon database locally/preview, production Neon
 * in production (ADR-006). In development, Next.js hot-reloads modules;
 * caching the client on globalThis prevents exhausting database connections
 * with a new pool per reload. Prisma access belongs in repositories and
 * server-side data modules only — never in components (RULES.md).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
