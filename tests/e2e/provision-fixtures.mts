// @next/env is CommonJS — use default-import interop under ESM.
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { ActiveStatus, OrganizationKind, Role } from "../../src/generated/prisma/enums";
import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

/**
 * E2E fixture provisioning (Stories 1.2/1.5). Runs under tsx (ESM) because
 * the generated Prisma client is ESM-first — the same pattern as
 * prisma/seed.mts. Invoked by tests/e2e/global-setup.ts.
 *
 * 1. Ensure the Clerk test-mode user exists in the dev instance.
 * 2. Mirror the production webhook: link that Clerk identity to an internal
 *    User (the dev instance cannot call localhost webhooks).
 * 3. Give the user a shelter membership in a dedicated synthetic E2E
 *    organization so cross-organization denial is testable end-to-end.
 *
 * Deterministic ids keep every step idempotent on the shared nonprod
 * database (ADR-006); all records are flagged isSynthetic.
 */
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required for E2E auth tests (.env.local)");
}

// 1. Ensure the Clerk user exists.
const createResponse = await fetch("https://api.clerk.com/v1/users", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email_address: [E2E_USER_EMAIL],
    password: E2E_USER_PASSWORD,
    first_name: "Synthetic",
    last_name: "E2E",
    skip_password_checks: true,
  }),
});

// 200 = created. 422 acceptable ONLY for "already exists" — other 422s
// (e.g. invalid email) must fail loudly.
if (!createResponse.ok) {
  const body = await createResponse.text();
  const alreadyExists =
    createResponse.status === 422 && body.includes("form_identifier_exists");
  if (!alreadyExists) {
    throw new Error(`Failed to ensure E2E test user (${createResponse.status}): ${body}`);
  }
}

// 2. Resolve the Clerk user id.
const lookup = await fetch(
  `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(E2E_USER_EMAIL)}`,
  { headers: { Authorization: `Bearer ${secretKey}` } },
);
if (!lookup.ok) {
  throw new Error(`Failed to look up E2E Clerk user (${lookup.status})`);
}
const users = (await lookup.json()) as { id: string }[];
const clerkUserId = users[0]?.id;
if (!clerkUserId) {
  throw new Error("E2E Clerk user not found after creation");
}

// 3. Provision the internal user + membership fixtures.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

try {
  const org = await prisma.organization.upsert({
    where: { id: "e2e_org_shelter" },
    update: {},
    create: {
      id: "e2e_org_shelter",
      name: "E2E Test Shelter (Synthetic)",
      kind: OrganizationKind.HOST,
      isSynthetic: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { clerkUserId },
    update: { email: E2E_USER_EMAIL },
    create: {
      id: "e2e_user_shelter",
      clerkUserId,
      email: E2E_USER_EMAIL,
      displayName: "Synthetic E2E",
      isSynthetic: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId_role: {
        userId: user.id,
        organizationId: org.id,
        role: Role.SHELTER_SUPERVISOR,
      },
    },
    update: { status: ActiveStatus.ACTIVE, deactivatedAt: null },
    create: { userId: user.id, organizationId: org.id, role: Role.SHELTER_SUPERVISOR },
  });

  console.log("E2E fixtures ready (Clerk user linked, e2e_org_shelter membership active).");
} finally {
  await prisma.$disconnect();
}
