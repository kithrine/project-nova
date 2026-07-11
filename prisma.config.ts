import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env — load it exactly the way Next.js does.
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Shared nonproduction Neon database for local + preview (ADR-006);
    // production uses its own DATABASE_URL set in Vercel env vars.
    // Migrations prefer the direct (non-pooled) connection — Neon's pooler
    // does not support the advisory locks Prisma Migrate requires.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
