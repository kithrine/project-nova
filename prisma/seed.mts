// @next/env is CommonJS — use default-import interop under ESM.
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { ActiveStatus, OrganizationKind, Role } from "../src/generated/prisma/enums";

// Self-sufficient env loading so the seed works whether invoked via
// `prisma db seed` or `tsx prisma/seed.mts` directly.
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

/**
 * Synthetic seed data ONLY — production data is never copied into
 * nonproduction (ADR-006, docs/ops/data-governance.md). Every record is
 * flagged isSynthetic and uses deterministic seed_* ids so re-runs are
 * idempotent and the launch checklist's "synthetic test data removed"
 * gate can find everything (docs/ops/launch-checklist.md).
 *
 * Relative imports only — this file runs under tsx, outside Next's resolver.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const SEED_USERS: { id: string; role: Role; displayName: string; email: string }[] = [
  { id: "seed_user_participant", role: Role.PARTICIPANT, displayName: "Synthetic Participant", email: "participant@synthetic.example" },
  { id: "seed_user_supervisor", role: Role.SHELTER_SUPERVISOR, displayName: "Synthetic Shelter Supervisor", email: "supervisor@synthetic.example" },
  { id: "seed_user_manager", role: Role.SHELTER_MANAGER, displayName: "Synthetic Shelter Manager", email: "manager@synthetic.example" },
  { id: "seed_user_coordinator", role: Role.PROGRAM_COORDINATOR, displayName: "Synthetic Program Coordinator", email: "coordinator@synthetic.example" },
  { id: "seed_user_grant_admin", role: Role.GRANT_ADMINISTRATOR, displayName: "Synthetic Grant Administrator", email: "grant-admin@synthetic.example" },
  { id: "seed_user_nova_admin", role: Role.NOVA_ADMINISTRATOR, displayName: "Synthetic Nova Administrator", email: "nova-admin@synthetic.example" },
  { id: "seed_user_restricted", role: Role.RESTRICTED_REVIEW_SPECIALIST, displayName: "Synthetic Restricted Review Specialist", email: "restricted-review@synthetic.example" },
];

async function main() {
  // Organizations
  const nova = await prisma.organization.upsert({
    where: { id: "seed_org_nova" },
    update: {},
    create: {
      id: "seed_org_nova",
      name: "Project Nova (Synthetic)",
      kind: OrganizationKind.NOVA,
      isSynthetic: true,
    },
  });

  const shelter = await prisma.organization.upsert({
    where: { id: "seed_org_shelter" },
    update: {},
    create: {
      id: "seed_org_shelter",
      name: "Sunny Paws Animal Shelter (Synthetic)",
      kind: OrganizationKind.HOST,
      isSynthetic: true,
    },
  });

  await prisma.organizationSite.upsert({
    where: { id: "seed_site_shelter_main" },
    update: {},
    create: {
      id: "seed_site_shelter_main",
      organizationId: shelter.id,
      name: "Main Campus (Synthetic)",
      city: "Springfield",
      region: "WA",
    },
  });

  // One user per role, with the membership in the appropriate organization.
  for (const seedUser of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { id: seedUser.id },
      update: {},
      create: {
        id: seedUser.id,
        email: seedUser.email,
        displayName: seedUser.displayName,
        isSynthetic: true,
      },
    });

    const organizationId =
      seedUser.role === Role.SHELTER_SUPERVISOR || seedUser.role === Role.SHELTER_MANAGER
        ? shelter.id
        : nova.id;

    await prisma.membership.upsert({
      where: {
        userId_organizationId_role: {
          userId: user.id,
          organizationId,
          role: seedUser.role,
        },
      },
      update: { status: ActiveStatus.ACTIVE, deactivatedAt: null },
      create: { userId: user.id, organizationId, role: seedUser.role },
    });
  }

  console.log(
    `Seed complete: 2 organizations, 1 site, ${SEED_USERS.length} users with memberships (all synthetic).`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
