// @next/env is CommonJS — use default-import interop under ESM.
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { ActiveStatus, OrganizationKind, Role } from "../../src/generated/prisma/enums";
import {
  E2E_APPLICANT_USER_EMAIL,
  E2E_DRAFT_USER_EMAIL,
  E2E_GRANT_ADMIN_USER_EMAIL,
  E2E_OPS_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./test-user";

/**
 * E2E fixture provisioning (Stories 1.2/1.5/1.7). Runs under tsx (ESM)
 * because the generated Prisma client is ESM-first — same pattern as
 * prisma/seed.mts. Invoked by tests/e2e/global-setup.ts.
 *
 * For each synthetic Clerk test-mode user: ensure it exists in the dev
 * Clerk instance, mirror the production webhook by linking it to an
 * internal User, and grant the membership its experience requires.
 * Deterministic ids keep everything idempotent on the shared nonprod
 * database (ADR-006); all records are flagged isSynthetic.
 */
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required for E2E auth tests (.env.local)");
}

interface FixtureUser {
  email: string;
  internalId: string;
  displayName: string;
  membership: { organizationId: string; role: Role } | null;
}

const FIXTURE_USERS: FixtureUser[] = [
  {
    email: E2E_USER_EMAIL,
    internalId: "e2e_user_shelter",
    displayName: "Synthetic E2E Shelter",
    membership: { organizationId: "e2e_org_shelter", role: Role.SHELTER_SUPERVISOR },
  },
  {
    email: E2E_OPS_USER_EMAIL,
    internalId: "e2e_user_ops",
    displayName: "Synthetic E2E Coordinator",
    membership: { organizationId: "e2e_org_nova", role: Role.PROGRAM_COORDINATOR },
  },
  {
    email: E2E_PARTICIPANT_USER_EMAIL,
    internalId: "e2e_user_participant",
    displayName: "Synthetic E2E Participant",
    membership: { organizationId: "e2e_org_nova", role: Role.PARTICIPANT },
  },
  {
    email: E2E_GRANT_ADMIN_USER_EMAIL,
    internalId: "e2e_user_grant",
    displayName: "Synthetic E2E Grant Admin",
    membership: { organizationId: "e2e_org_nova", role: Role.GRANT_ADMINISTRATOR },
  },
];

async function ensureClerkUser(email: string): Promise<string> {
  const createResponse = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
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
      throw new Error(`Failed to ensure Clerk user ${email} (${createResponse.status}): ${body}`);
    }
  }

  const lookup = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!lookup.ok) {
    throw new Error(`Failed to look up Clerk user ${email} (${lookup.status})`);
  }
  const users = (await lookup.json()) as { id: string }[];
  const clerkUserId = users[0]?.id;
  if (!clerkUserId) {
    throw new Error(`Clerk user ${email} not found after creation`);
  }
  return clerkUserId;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

try {
  // Organizations the fixtures belong to.
  await prisma.organization.upsert({
    where: { id: "e2e_org_shelter" },
    update: {},
    create: {
      id: "e2e_org_shelter",
      name: "E2E Test Shelter (Synthetic)",
      kind: OrganizationKind.HOST,
      isSynthetic: true,
    },
  });
  await prisma.organization.upsert({
    where: { id: "e2e_org_nova" },
    update: {},
    create: {
      id: "e2e_org_nova",
      name: "E2E Project Nova (Synthetic)",
      kind: OrganizationKind.NOVA,
      isSynthetic: true,
    },
  });

  for (const fixture of FIXTURE_USERS) {
    const clerkUserId = await ensureClerkUser(fixture.email);

    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: { email: fixture.email },
      create: {
        id: fixture.internalId,
        clerkUserId,
        email: fixture.email,
        displayName: fixture.displayName,
        isSynthetic: true,
      },
    });

    if (fixture.membership) {
      await prisma.membership.upsert({
        where: {
          userId_organizationId_role: {
            userId: user.id,
            organizationId: fixture.membership.organizationId,
            role: fixture.membership.role,
          },
        },
        update: { status: ActiveStatus.ACTIVE, deactivatedAt: null },
        create: {
          userId: user.id,
          organizationId: fixture.membership.organizationId,
          role: fixture.membership.role,
        },
      });
    }
  }

  // The fresh-applicant identity (Story 2.2) exists in Clerk only — ensure
  // the Clerk user, then delete any internal rows a previous run created so
  // provision-on-first-sign-in + onboarding run from scratch every time.
  // Each resettable identity is owned by exactly ONE spec file (files run in
  // parallel). Children first (FKs are RESTRICT):
  // applications -> profile -> person -> user.
  for (const email of [E2E_APPLICANT_USER_EMAIL, E2E_DRAFT_USER_EMAIL]) {
    await ensureClerkUser(email);
    // Delete this identity's stored blobs before their metadata rows
    // (targeted storage cleanup, ADR-006 discipline).
    const docs = await prisma.document.findMany({
      where: { application: { person: { user: { email } } } },
      select: { storagePathname: true },
    });
    if (docs.length > 0) {
      const { del } = await import("@vercel/blob");
      await del(docs.map((d) => d.storagePathname)).catch(() => {});
    }
    await prisma.document.deleteMany({
      where: { application: { person: { user: { email } } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email } } },
    });
    await prisma.applicantProfile.deleteMany({
      where: { person: { user: { email } } },
    });
    await prisma.person.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  }

  // Targeted cleanup of rows created by PREVIOUS funding E2E runs (ADR-006:
  // clean only our own synthetic test rows, never truncate). Safe while
  // funding sources have no dependents; revisit when Story 5.3 adds
  // funding assignments.
  const cleaned = await prisma.fundingSource.deleteMany({
    where: { name: { startsWith: "E2E Synthetic" } },
  });

  console.log(
    `E2E fixtures ready (${FIXTURE_USERS.length + 1} users, 2 organizations; ` +
      `applicant reset; ${cleaned.count} prior funding fixtures cleaned).`,
  );
} finally {
  await prisma.$disconnect();
}
