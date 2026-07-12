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
  {
    id: "seed_user_participant",
    role: Role.PARTICIPANT,
    displayName: "Synthetic Participant",
    email: "participant@synthetic.example",
  },
  {
    id: "seed_user_supervisor",
    role: Role.SHELTER_SUPERVISOR,
    displayName: "Synthetic Shelter Supervisor",
    email: "supervisor@synthetic.example",
  },
  {
    id: "seed_user_manager",
    role: Role.SHELTER_MANAGER,
    displayName: "Synthetic Shelter Manager",
    email: "manager@synthetic.example",
  },
  {
    id: "seed_user_coordinator",
    role: Role.PROGRAM_COORDINATOR,
    displayName: "Synthetic Program Coordinator",
    email: "coordinator@synthetic.example",
  },
  {
    id: "seed_user_grant_admin",
    role: Role.GRANT_ADMINISTRATOR,
    displayName: "Synthetic Grant Administrator",
    email: "grant-admin@synthetic.example",
  },
  {
    id: "seed_user_nova_admin",
    role: Role.NOVA_ADMINISTRATOR,
    displayName: "Synthetic Nova Administrator",
    email: "nova-admin@synthetic.example",
  },
  {
    id: "seed_user_restricted",
    role: Role.RESTRICTED_REVIEW_SPECIALIST,
    displayName: "Synthetic Restricted Review Specialist",
    email: "restricted-review@synthetic.example",
  },
];

const NOVA_TE_TASKS = [
  {
    id: "nova_te_task_01",
    title: "Attend orientation session",
    description: "Join the Project Nova orientation and meet your coordinator.",
    required: true,
    participantCompletable: false,
    sortOrder: 1,
  },
  {
    id: "nova_te_task_02",
    title: "Complete employment paperwork",
    description: "I-9 and W-4 forms, completed and verified with your coordinator.",
    required: true,
    participantCompletable: false,
    sortOrder: 2,
  },
  {
    id: "nova_te_task_03",
    title: "Set up direct deposit or pay card",
    description: "Choose how you'd like to be paid.",
    required: true,
    participantCompletable: true,
    sortOrder: 3,
  },
  {
    id: "nova_te_task_04",
    title: "Add an emergency contact",
    description: "Someone we can reach if anything comes up at a work site.",
    required: true,
    participantCompletable: true,
    sortOrder: 4,
  },
  {
    id: "nova_te_task_05",
    title: "Review the program handbook",
    description: "The plain-language guide to how the program works.",
    required: true,
    participantCompletable: true,
    sortOrder: 5,
  },
];

const NOVA_TE_TRAINING_PROGRAMS = [
  {
    id: "nova_te_training_workplace_readiness",
    code: "WORKPLACE-READINESS",
    name: "Workplace Readiness and Communication",
    description:
      "Workplace expectations, communication, feedback, escalation, digital navigation, and requesting support.",
    requiredForMatching: true,
    sortOrder: 1,
  },
  {
    id: "nova_te_training_animal_handling",
    code: "ANIMAL-HANDLING-FOUNDATIONS",
    name: "Animal Behavior, Humane Handling, and Bite Prevention Foundations",
    description:
      "Animal body language, fear and stress signals, objective observation, low-stress handling concepts, bite prevention, and stop-and-get-help boundaries.",
    requiredForMatching: true,
    sortOrder: 2,
  },
  {
    id: "nova_te_training_sanitation",
    code: "SHELTER-SANITATION-FOUNDATIONS",
    name: "Shelter Sanitation, Zoonoses, and PPE Foundations",
    description:
      "Hygiene, cleaning and disinfection, zoonotic-risk awareness, PPE concepts, chemical-label awareness, and exposure and injury reporting.",
    requiredForMatching: true,
    sortOrder: 3,
  },
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

  // The default Program (Story 3.1) is REAL reference data, not synthetic:
  // the acceptance flow resolves it by stable code in every environment, so
  // it is deliberately NOT flagged isSynthetic and survives the launch
  // checklist's synthetic-data removal.
  await prisma.program.upsert({
    where: { code: "NOVA-TE" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "program_nova_te",
      code: "NOVA-TE",
      name: "Transitional Employment Program",
    },
  });

  // Required-task catalog (Story 3.2): reference data like the program.
  for (const task of NOVA_TE_TASKS) {
    await prisma.onboardingTaskTemplate.upsert({
      where: { id: task.id },
      update: { ...task, programId: "program_nova_te" },
      create: { ...task, programId: "program_nova_te" },
    });
  }

  // Portable pre-matching training catalog (Story 3.4; ADR-017).
  for (const trainingProgram of NOVA_TE_TRAINING_PROGRAMS) {
    await prisma.trainingProgram.upsert({
      where: { id: trainingProgram.id },
      update: { ...trainingProgram, programId: "program_nova_te" },
      create: { ...trainingProgram, programId: "program_nova_te" },
    });
  }

  console.log(
    `Seed complete: 2 organizations, 1 site, ${SEED_USERS.length} users with memberships (all synthetic), 1 program + ${NOVA_TE_TASKS.length} onboarding task templates + ${NOVA_TE_TRAINING_PROGRAMS.length} training programs (reference data).`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
