// @next/env is CommonJS — use default-import interop under ESM.
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import {
  ActiveStatus,
  FundingSourceKind,
  ApplicationStatus,
  OnboardingTaskStatus,
  OrganizationKind,
  Role,
} from "../../src/generated/prisma/enums";
import {
  E2E_APPLICANT_USER_EMAIL,
  E2E_DRAFT_USER_EMAIL,
  E2E_GRANT_ADMIN_USER_EMAIL,
  E2E_OPS_USER_EMAIL,
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_HOURS_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_RRS_USER_EMAIL,
  E2E_SHELTER_MANAGER_USER_EMAIL,
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
    email: E2E_SHELTER_MANAGER_USER_EMAIL,
    internalId: "e2e_user_manager",
    displayName: "Synthetic E2E Manager",
    membership: { organizationId: "e2e_org_shelter", role: Role.SHELTER_MANAGER },
  },
  {
    email: E2E_OTHER_MANAGER_USER_EMAIL,
    internalId: "e2e_user_manager2",
    displayName: "Synthetic E2E Other Manager",
    membership: { organizationId: "e2e_org_shelter2", role: Role.SHELTER_MANAGER },
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
    email: E2E_HOURS_USER_EMAIL,
    internalId: "e2e_user_hours",
    displayName: "Synthetic E2E Hours",
    membership: { organizationId: "e2e_org_nova", role: Role.PARTICIPANT },
  },
  {
    email: E2E_GRANT_ADMIN_USER_EMAIL,
    internalId: "e2e_user_grant",
    displayName: "Synthetic E2E Grant Admin",
    membership: { organizationId: "e2e_org_nova", role: Role.GRANT_ADMINISTRATOR },
  },
  {
    email: E2E_RRS_USER_EMAIL,
    internalId: "e2e_user_rrs",
    displayName: "Synthetic E2E Review Specialist",
    membership: {
      organizationId: "e2e_org_nova",
      role: Role.RESTRICTED_REVIEW_SPECIALIST,
    },
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
      "Animal body language, safe handling foundations, bite prevention, and stop-and-get-help boundaries.",
    requiredForMatching: true,
    sortOrder: 2,
  },
  {
    id: "nova_te_training_sanitation",
    code: "SHELTER-SANITATION-FOUNDATIONS",
    name: "Shelter Sanitation, Zoonoses, and PPE Foundations",
    description:
      "Hygiene, cleaning and disinfection, zoonotic-risk awareness, PPE concepts, and reporting.",
    requiredForMatching: true,
    sortOrder: 3,
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
      throw new Error(
        `Failed to ensure Clerk user ${email} (${createResponse.status}): ${body}`,
      );
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
  // A second host shelter (Story 4.6): its manager sees an EMPTY approvals
  // list — organization scope end-to-end, not just in integration tests.
  await prisma.organization.upsert({
    where: { id: "e2e_org_shelter2" },
    update: {},
    create: {
      id: "e2e_org_shelter2",
      name: "E2E Other Shelter (Synthetic)",
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
  // events + documents -> applications -> profile -> person -> user.
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
    await prisma.applicationEvent.deleteMany({
      where: { application: { person: { user: { email } } } },
    });
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

  // Deterministic Operations-queue fixture (Story 2.7): a SUBMITTED
  // application owned by an internal-only synthetic person — no Clerk
  // account; Operations E2E only reads it. Upserted (and its status reset)
  // so every run sees the same workspace at
  // /operations/applications/e2e_app_queue.
  const queueUser = await prisma.user.upsert({
    where: { id: "e2e_user_queue" },
    update: {},
    create: {
      id: "e2e_user_queue",
      email: "e2e-queue-applicant@synthetic.example",
      displayName: "Synthetic E2E Queue Applicant",
      isSynthetic: true,
    },
  });
  const queuePerson = await prisma.person.upsert({
    where: { userId: queueUser.id },
    update: {},
    create: {
      id: "e2e_person_queue",
      userId: queueUser.id,
      legalFirstName: "Quinn",
      legalLastName: "Synthetic-Queue",
      dateOfBirth: new Date("1990-04-04T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_queue" },
    update: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
    create: {
      id: "e2e_app_queue",
      personId: queuePerson.id,
      applicationNumber: "APP-E2E-QUEUE",
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      motivation: "Synthetic queue fixture.",
      workExperience: "Synthetic.",
      animalExperience: "Synthetic.",
      availabilityNotes: "Synthetic.",
      transportationNotes: "Synthetic.",
    },
  });

  // Decision fixture (Story 2.11): a SUBMITTED application the operations
  // E2E rejects through the Decision Panel each run. Fully reset here:
  // status back to SUBMITTED, decision fields cleared, person unmarked, and
  // prior runs' decision events/audits removed.
  const decisionUser = await prisma.user.upsert({
    where: { id: "e2e_user_decision" },
    update: {},
    create: {
      id: "e2e_user_decision",
      email: "e2e-decision-applicant@synthetic.example",
      displayName: "Synthetic E2E Decision Applicant",
      isSynthetic: true,
    },
  });
  const decisionPerson = await prisma.person.upsert({
    where: { userId: decisionUser.id },
    update: { disqualifiedAt: null },
    create: {
      id: "e2e_person_decision",
      userId: decisionUser.id,
      legalFirstName: "Devon",
      legalLastName: "Synthetic-Decision",
      dateOfBirth: new Date("1991-05-05T00:00:00Z"),
    },
  });
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: "e2e_app_decision" },
  });
  await prisma.auditEvent.deleteMany({
    where: { subjectType: "Application", subjectId: "e2e_app_decision" },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_decision" },
    update: {
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      decidedAt: null,
      decisionReason: null,
    },
    create: {
      id: "e2e_app_decision",
      personId: decisionPerson.id,
      applicationNumber: "APP-E2E-DECIDE",
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      motivation: "Synthetic decision fixture.",
      workExperience: "Synthetic.",
      animalExperience: "Synthetic.",
      availabilityNotes: "Synthetic.",
      transportationNotes: "Synthetic.",
    },
  });

  // Eligibility fixture (Story 2.8): a SUBMITTED application the operations
  // E2E takes through begin -> Eligible each run. Fully reset here.
  const eligibilityUser = await prisma.user.upsert({
    where: { id: "e2e_user_eligibility" },
    update: {},
    create: {
      id: "e2e_user_eligibility",
      email: "e2e-eligibility-applicant@synthetic.example",
      displayName: "Synthetic E2E Eligibility Applicant",
      isSynthetic: true,
    },
  });
  const eligibilityPerson = await prisma.person.upsert({
    where: { userId: eligibilityUser.id },
    update: { disqualifiedAt: null },
    create: {
      id: "e2e_person_eligibility",
      userId: eligibilityUser.id,
      legalFirstName: "Ellis",
      legalLastName: "Synthetic-Eligibility",
      dateOfBirth: new Date("1992-06-06T00:00:00Z"),
    },
  });
  await prisma.eligibilityReview.deleteMany({
    where: { applicationId: "e2e_app_eligibility" },
  });
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: "e2e_app_eligibility" },
  });
  await prisma.auditEvent.deleteMany({
    where: { subjectType: "Application", subjectId: "e2e_app_eligibility" },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_eligibility" },
    update: {
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      decidedAt: null,
      decisionReason: null,
    },
    create: {
      id: "e2e_app_eligibility",
      personId: eligibilityPerson.id,
      applicationNumber: "APP-E2E-ELIGIB",
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      motivation: "Synthetic eligibility fixture.",
      workExperience: "Synthetic.",
      animalExperience: "Synthetic.",
      availabilityNotes: "Synthetic.",
      transportationNotes: "Synthetic.",
    },
  });

  // Interview fixture (Story 2.9): an application in the INTERVIEW phase the
  // operations E2E schedules and advances each run. Fully reset here.
  const interviewUser = await prisma.user.upsert({
    where: { id: "e2e_user_interview" },
    update: {},
    create: {
      id: "e2e_user_interview",
      email: "e2e-interview-applicant@synthetic.example",
      displayName: "Synthetic E2E Interview Applicant",
      isSynthetic: true,
    },
  });
  const interviewPerson = await prisma.person.upsert({
    where: { userId: interviewUser.id },
    update: { disqualifiedAt: null },
    create: {
      id: "e2e_person_interview",
      userId: interviewUser.id,
      legalFirstName: "Indra",
      legalLastName: "Synthetic-Interview",
      dateOfBirth: new Date("1993-03-03T00:00:00Z"),
    },
  });
  await prisma.interview.deleteMany({ where: { applicationId: "e2e_app_interview" } });
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: "e2e_app_interview" },
  });
  await prisma.auditEvent.deleteMany({
    where: { subjectType: "Application", subjectId: "e2e_app_interview" },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_interview" },
    update: {
      status: ApplicationStatus.INTERVIEW,
      submittedAt: new Date(),
      decidedAt: null,
      decisionReason: null,
    },
    create: {
      id: "e2e_app_interview",
      personId: interviewPerson.id,
      applicationNumber: "APP-E2E-INTRVW",
      status: ApplicationStatus.INTERVIEW,
      submittedAt: new Date(),
      motivation: "Synthetic interview fixture.",
      workExperience: "Synthetic.",
      animalExperience: "Synthetic.",
      availabilityNotes: "Synthetic.",
      transportationNotes: "Synthetic.",
    },
  });

  // Default program (Story 3.1): REAL reference data resolved by code at
  // acceptance time — same row the seed maintains.
  await prisma.program.upsert({
    where: { code: "NOVA-TE" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "program_nova_te",
      code: "NOVA-TE",
      name: "Transitional Employment Program",
    },
  });

  // Required-task catalog (Story 3.2) — same reference rows the seed keeps.
  for (const task of NOVA_TE_TASKS) {
    await prisma.onboardingTaskTemplate.upsert({
      where: { id: task.id },
      update: { ...task, programId: "program_nova_te" },
      create: { ...task, programId: "program_nova_te" },
    });
  }
  for (const trainingProgram of NOVA_TE_TRAINING_PROGRAMS) {
    await prisma.trainingProgram.upsert({
      where: { id: trainingProgram.id },
      update: { ...trainingProgram, programId: "program_nova_te" },
      create: { ...trainingProgram, programId: "program_nova_te" },
    });
  }

  // Background fixture (Story 2.10): an application in BACKGROUND_REVIEW the
  // operations E2E clears (RRS) and then accepts (PC) each run. Fully reset.
  const backgroundUser = await prisma.user.upsert({
    where: { id: "e2e_user_background" },
    update: {},
    create: {
      id: "e2e_user_background",
      email: "e2e-background-applicant@synthetic.example",
      displayName: "Synthetic E2E Background Applicant",
      isSynthetic: true,
    },
  });
  const backgroundPerson = await prisma.person.upsert({
    where: { userId: backgroundUser.id },
    update: { disqualifiedAt: null },
    create: {
      id: "e2e_person_background",
      userId: backgroundUser.id,
      legalFirstName: "Blair",
      legalLastName: "Synthetic-Background",
      dateOfBirth: new Date("1994-04-04T00:00:00Z"),
    },
  });
  await prisma.backgroundReview.deleteMany({
    where: { applicationId: "e2e_app_background" },
  });
  await prisma.applicationEvent.deleteMany({
    where: { applicationId: "e2e_app_background" },
  });
  await prisma.auditEvent.deleteMany({
    where: { subjectType: "Application", subjectId: "e2e_app_background" },
  });
  // The prior run's acceptance created an enrollment chain (3.1/3.2) —
  // remove it so re-accepting the reset application never collides with
  // the one-enrollment-per-application constraint. Children first.
  const priorEnrollment = await prisma.programEnrollment.findUnique({
    where: { applicationId: "e2e_app_background" },
    select: { id: true },
  });
  if (priorEnrollment) {
    await prisma.onboardingTask.deleteMany({
      where: { enrollmentId: priorEnrollment.id },
    });
    await prisma.enrollmentEvent.deleteMany({
      where: { enrollmentId: priorEnrollment.id },
    });
    await prisma.auditEvent.deleteMany({
      where: { subjectType: "ProgramEnrollment", subjectId: priorEnrollment.id },
    });
    await prisma.programEnrollment.delete({ where: { id: priorEnrollment.id } });
  }
  await prisma.participant.deleteMany({ where: { personId: "e2e_person_background" } });
  await prisma.application.upsert({
    where: { id: "e2e_app_background" },
    update: {
      status: ApplicationStatus.BACKGROUND_REVIEW,
      submittedAt: new Date(),
      decidedAt: null,
      decisionReason: null,
    },
    create: {
      id: "e2e_app_background",
      personId: backgroundPerson.id,
      applicationNumber: "APP-E2E-BCKGRD",
      status: ApplicationStatus.BACKGROUND_REVIEW,
      submittedAt: new Date(),
      motivation: "Synthetic background fixture.",
      workExperience: "Synthetic.",
      animalExperience: "Synthetic.",
      availabilityNotes: "Synthetic.",
      transportationNotes: "Synthetic.",
    },
  });

  // Participant onboarding fixture (Story 3.3): the persistent participant
  // identity gains a person, participant, ONBOARDING enrollment, and two
  // deterministic tasks (one participant-completable, one staff-only),
  // reset to Not Started every run.
  const participantFixtureUser = await prisma.user.findUniqueOrThrow({
    where: { id: "e2e_user_participant" },
  });
  await prisma.person.upsert({
    where: { userId: participantFixtureUser.id },
    update: {},
    create: {
      id: "e2e_person_participant",
      userId: participantFixtureUser.id,
      legalFirstName: "Parker",
      legalLastName: "Synthetic-Participant",
      dateOfBirth: new Date("1990-01-01T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_participant" },
    update: {},
    create: {
      id: "e2e_app_participant",
      personId: "e2e_person_participant",
      applicationNumber: "APP-E2E-PRTCPT",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_participant" },
    update: {},
    create: { id: "e2e_participant_main", personId: "e2e_person_participant" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_participant" },
    update: { status: "ONBOARDING" },
    create: {
      id: "e2e_enrollment_participant",
      participantId: "e2e_participant_main",
      programId: "program_nova_te",
      applicationId: "e2e_app_participant",
    },
  });
  const participantTaskReset = {
    status: OnboardingTaskStatus.NOT_STARTED,
    completedAt: null,
    completedByUserId: null,
  };
  await prisma.onboardingTask.upsert({
    where: { id: "e2e_task_participant_own" },
    update: participantTaskReset,
    create: {
      id: "e2e_task_participant_own",
      enrollmentId: "e2e_enrollment_participant",
      title: "Confirm your contact information",
      description: "Make sure we can reach you.",
      required: true,
      participantCompletable: true,
      sortOrder: 1,
    },
  });

  // Dedicated coordinator-training fixture (Story 3.4). No Clerk identity is
  // needed for the subject; the coordinator operates the enrollment. Reset
  // only this enrollment's attempts so E2E retries converge safely.
  await prisma.user.upsert({
    where: { id: "e2e_user_training_subject" },
    update: {},
    create: {
      id: "e2e_user_training_subject",
      email: "e2e-training-subject@synthetic.example",
      displayName: "Synthetic Training Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_training_subject" },
    update: {},
    create: {
      id: "e2e_person_training",
      userId: "e2e_user_training_subject",
      legalFirstName: "Taylor",
      legalLastName: "Synthetic-Training",
      dateOfBirth: new Date("1990-01-01T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_training" },
    update: {},
    create: {
      id: "e2e_app_training",
      personId: "e2e_person_training",
      applicationNumber: "APP-E2E-TRAIN",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_training" },
    update: {},
    create: { id: "e2e_participant_training", personId: "e2e_person_training" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_training" },
    update: { status: "ONBOARDING" },
    create: {
      id: "e2e_enrollment_training",
      participantId: "e2e_participant_training",
      programId: "program_nova_te",
      applicationId: "e2e_app_training",
    },
  });
  const priorTrainingAttempts = await prisma.trainingEnrollment.findMany({
    where: { programEnrollmentId: "e2e_enrollment_training" },
    select: { id: true },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      subjectType: "TrainingEnrollment",
      subjectId: { in: priorTrainingAttempts.map((attempt) => attempt.id) },
    },
  });
  await prisma.trainingEnrollmentEvent.deleteMany({
    where: { trainingEnrollment: { programEnrollmentId: "e2e_enrollment_training" } },
  });
  await prisma.trainingEnrollment.deleteMany({
    where: { programEnrollmentId: "e2e_enrollment_training" },
  });
  await prisma.onboardingTask.upsert({
    where: { id: "e2e_task_participant_staff" },
    update: participantTaskReset,
    create: {
      id: "e2e_task_participant_staff",
      enrollmentId: "e2e_enrollment_participant",
      title: "Verify identity documents",
      description: "Nova staff verify originals at the office.",
      required: true,
      participantCompletable: false,
      sortOrder: 2,
    },
  });

  // Certification fixtures (Story 3.5): reset the training subject's
  // certifications (the coordinator E2E records + attaches each run —
  // delete stored blobs before their metadata rows) and pin a deterministic
  // certification on the participant identity for the read-only view test.
  const fixtureParticipantIds = ["e2e_participant_training", "e2e_participant_main"];
  const certDocs = await prisma.document.findMany({
    where: { certification: { participantId: { in: fixtureParticipantIds } } },
    select: { storagePathname: true },
  });
  if (certDocs.length > 0) {
    const { del } = await import("@vercel/blob");
    await del(certDocs.map((d) => d.storagePathname)).catch(() => {});
  }
  await prisma.document.deleteMany({
    where: { certification: { participantId: { in: fixtureParticipantIds } } },
  });
  await prisma.certification.deleteMany({
    where: { participantId: "e2e_participant_training" },
  });
  await prisma.certification.upsert({
    where: { id: "e2e_cert_participant" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "e2e_cert_participant",
      participantId: "e2e_participant_main",
      name: "Pet First Aid & CPR (Synthetic)",
      issuer: "Synthetic Animal Care Academy",
      issuedOn: new Date("2026-01-05T00:00:00Z"),
      expiresOn: new Date("2030-01-05T00:00:00Z"),
      requiredForMatching: false,
    },
  });

  // Readiness fixture (Story 3.6): its OWN program with exactly one
  // required training, one required task, and one required-but-EXPIRED
  // certification — the E2E watches three blockers shrink to none. Fully
  // reset every run.
  await prisma.program.upsert({
    where: { code: "E2E-RDY" },
    update: {},
    create: { id: "e2e_program_readiness", code: "E2E-RDY", name: "E2E Readiness Program (Synthetic)" },
  });
  await prisma.trainingProgram.upsert({
    where: { id: "e2e_training_readiness" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "e2e_training_readiness",
      programId: "e2e_program_readiness",
      code: "E2E-RDY-CORE",
      name: "Core Readiness Training (Synthetic)",
      description: "Synthetic training for the readiness E2E.",
      requiredForMatching: true,
      sortOrder: 1,
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_user_readiness" },
    update: {},
    create: {
      id: "e2e_user_readiness",
      email: "e2e-readiness-subject@synthetic.example",
      displayName: "Synthetic Readiness Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_readiness" },
    update: {},
    create: {
      id: "e2e_person_readiness",
      userId: "e2e_user_readiness",
      legalFirstName: "Riley",
      legalLastName: "Synthetic-Readiness",
      dateOfBirth: new Date("1991-09-09T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_readiness" },
    update: {},
    create: {
      id: "e2e_app_readiness",
      personId: "e2e_person_readiness",
      applicationNumber: "APP-E2E-READY1",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_readiness" },
    update: {},
    create: { id: "e2e_participant_readiness", personId: "e2e_person_readiness" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_readiness" },
    update: { status: "ONBOARDING" },
    create: {
      id: "e2e_enrollment_readiness",
      participantId: "e2e_participant_readiness",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_readiness",
    },
  });
  await prisma.onboardingTask.upsert({
    where: { id: "e2e_task_readiness" },
    update: { status: OnboardingTaskStatus.NOT_STARTED, completedAt: null, completedByUserId: null },
    create: {
      id: "e2e_task_readiness",
      enrollmentId: "e2e_enrollment_readiness",
      title: "Confirm readiness paperwork",
      description: "Synthetic required task.",
      required: true,
      participantCompletable: false,
      sortOrder: 1,
    },
  });
  // Reset the 3.7 transition too: prior runs' lifecycle/audit events go,
  // and the enrollment returns to ONBOARDING (the upsert above).
  await prisma.enrollmentEvent.deleteMany({
    where: { enrollmentId: "e2e_enrollment_readiness" },
  });
  await prisma.auditEvent.deleteMany({
    where: { subjectType: "ProgramEnrollment", subjectId: "e2e_enrollment_readiness" },
  });
  const readinessAttempts = await prisma.trainingEnrollment.findMany({
    where: { programEnrollmentId: "e2e_enrollment_readiness" },
    select: { id: true },
  });
  if (readinessAttempts.length > 0) {
    await prisma.trainingEnrollmentEvent.deleteMany({
      where: { trainingEnrollmentId: { in: readinessAttempts.map((a) => a.id) } },
    });
    await prisma.trainingEnrollment.deleteMany({
      where: { id: { in: readinessAttempts.map((a) => a.id) } },
    });
  }
  await prisma.certification.upsert({
    where: { id: "e2e_cert_readiness" },
    update: {
      status: ActiveStatus.ACTIVE,
      requiredForMatching: true,
      expiresOn: new Date("2025-01-01T00:00:00Z"),
    },
    create: {
      id: "e2e_cert_readiness",
      participantId: "e2e_participant_readiness",
      name: "Safety Credential (Synthetic)",
      issuer: "Synthetic Issuer",
      issuedOn: new Date("2024-01-01T00:00:00Z"),
      expiresOn: new Date("2025-01-01T00:00:00Z"),
      requiredForMatching: true,
    },
  });

  // Matching-queue fixtures (Story 4.1): a shelter site with capacity and a
  // READY_FOR_MATCHING participant (Quinn) with no match — reset every run.
  await prisma.organizationSite.upsert({
    where: { id: "e2e_site_shelter" },
    update: { status: ActiveStatus.ACTIVE, capacity: 3 },
    create: {
      id: "e2e_site_shelter",
      organizationId: "e2e_org_shelter",
      name: "Main Site (Synthetic)",
      city: "Springfield",
      region: "WA",
      capacity: 3,
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_user_matchready" },
    update: {},
    create: {
      id: "e2e_user_matchready",
      email: "e2e-matchready-subject@synthetic.example",
      displayName: "Synthetic Matchready Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_matchready" },
    update: {},
    create: {
      id: "e2e_person_matchready",
      userId: "e2e_user_matchready",
      legalFirstName: "Quinn",
      legalLastName: "Synthetic-Match",
      dateOfBirth: new Date("1992-02-02T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_matchready" },
    update: {},
    create: {
      id: "e2e_app_matchready",
      personId: "e2e_person_matchready",
      applicationNumber: "APP-E2E-MATCH1",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
      availabilityNotes: "Weekday mornings",
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_matchready" },
    update: {},
    create: { id: "e2e_participant_matchready", personId: "e2e_person_matchready" },
  });
  // Placements before their source matches (sourceMatchId is RESTRICT) —
  // the 4.8 journey approves Quinn's match into a placement each run.
  await prisma.onboardingTask.deleteMany({
    where: { placement: { participantId: "e2e_participant_matchready" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_matchready" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_matchready" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_matchready" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_matchready" },
  });
  await prisma.enrollmentEvent.deleteMany({
    where: { enrollmentId: "e2e_enrollment_matchready" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_matchready" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "e2e_enrollment_matchready",
      participantId: "e2e_participant_matchready",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_matchready",
      status: "READY_FOR_MATCHING",
    },
  });
  await prisma.enrollmentEvent.create({
    data: {
      enrollmentId: "e2e_enrollment_matchready",
      fromStatus: "ONBOARDING",
      toStatus: "READY_FOR_MATCHING",
      actorUserId: "e2e_user_ops",
    },
  });

  // Participant-decision fixture (Story 4.5): Quinn has no signable Clerk
  // identity, so the self-service Accept flow is exercised on PARKER — the
  // real participant login — via a PROPOSED match written directly (the
  // service's draft/propose path is E2E'd on Quinn's journey). Reset to a
  // fresh pending proposal every run; schedule text is distinct from
  // Quinn's so shelter-dashboard assertions never collide.
  // Parker's placement (Story 5.1 fixture below) references one of these
  // matches with a RESTRICT FK — placement children, then placements,
  // then matches.
  await prisma.fundingAssignment.deleteMany({
    where: { placement: { participantId: "e2e_participant_main" } },
  });
  // Case notes (Story 5.9) hang off placements with RESTRICT — revisions,
  // then notes, before the placement rows.
  await prisma.caseNoteRevision.deleteMany({
    where: { caseNote: { placement: { participantId: "e2e_participant_main" } } },
  });
  await prisma.caseNote.deleteMany({
    where: { placement: { participantId: "e2e_participant_main" } },
  });
  await prisma.onboardingTask.deleteMany({
    where: { placement: { participantId: "e2e_participant_main" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_main" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_main" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_main" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_main" },
  });
  const parkerProposedAt = new Date();
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_participant",
      participantId: "e2e_participant_main",
      programEnrollmentId: "e2e_enrollment_participant",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "PROPOSED",
      proposedSupervisorId: "e2e_user_shelter",
      proposedSchedule: "Tue/Thu afternoons",
      proposedStartDate: new Date("2026-08-10T00:00:00Z"),
      proposedEndDate: new Date("2026-12-11T00:00:00Z"),
      proposedAt: parkerProposedAt,
      decisionWindowEndsAt: new Date(
        parkerProposedAt.getTime() + 14 * 86_400_000,
      ),
    },
  });
  await prisma.placementMatchEvent.create({
    data: {
      placementMatchId: "e2e_match_participant",
      fromStatus: "DRAFT",
      toStatus: "PROPOSED",
      actorUserId: "e2e_user_ops",
    },
  });

  // Shelter-decision fixture (Story 4.6): Riley carries a fresh PROPOSED
  // match each run for the manager's Request Changes flow — separate from
  // Quinn (the coordinator journey) and Parker (the participant Accept)
  // so parallel spec workers never race on one record. Riley has no Clerk
  // identity; only staff act on this match.
  await prisma.user.upsert({
    where: { id: "e2e_user_changeready" },
    update: {},
    create: {
      id: "e2e_user_changeready",
      email: "e2e-changeready-subject@synthetic.example",
      displayName: "Synthetic Changeready Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_changeready" },
    update: {},
    create: {
      id: "e2e_person_changeready",
      userId: "e2e_user_changeready",
      legalFirstName: "Riley",
      legalLastName: "Synthetic-Change",
      dateOfBirth: new Date("1993-03-03T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_changeready" },
    update: {},
    create: {
      id: "e2e_app_changeready",
      personId: "e2e_person_changeready",
      applicationNumber: "APP-E2E-CHANGE1",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
      availabilityNotes: "Friday mornings",
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_changeready" },
    update: {},
    create: { id: "e2e_participant_changeready", personId: "e2e_person_changeready" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_changeready" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "e2e_enrollment_changeready",
      participantId: "e2e_participant_changeready",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_changeready",
      status: "READY_FOR_MATCHING",
    },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_changeready" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_changeready" },
  });
  const rileyProposedAt = new Date();
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_changeready",
      participantId: "e2e_participant_changeready",
      programEnrollmentId: "e2e_enrollment_changeready",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "PROPOSED",
      proposedSupervisorId: "e2e_user_shelter",
      proposedSchedule: "Fri mornings",
      proposedStartDate: new Date("2026-08-17T00:00:00Z"),
      proposedEndDate: new Date("2026-12-18T00:00:00Z"),
      proposedAt: rileyProposedAt,
      decisionWindowEndsAt: new Date(rileyProposedAt.getTime() + 14 * 86_400_000),
    },
  });
  await prisma.placementMatchEvent.create({
    data: {
      placementMatchId: "e2e_match_changeready",
      fromStatus: "DRAFT",
      toStatus: "PROPOSED",
      actorUserId: "e2e_user_ops",
    },
  });

  // Placement-workspace fixture (Story 5.1): PARKER — the real participant
  // login — carries an ONBOARDING placement so all three role-shaped
  // workspace views are E2E-testable. Its source is a terminal APPROVED
  // match separate from Parker's live PROPOSED one (one-non-terminal-match
  // index only covers non-terminal statuses). Reset every run.
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_main" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_main" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatchId: "e2e_match_placement_src" },
  });
  await prisma.placementMatch.deleteMany({
    where: { id: "e2e_match_placement_src" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_placement_src",
      participantId: "e2e_participant_main",
      programEnrollmentId: "e2e_enrollment_participant",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "APPROVED",
      // A real 4.8 approval requires both decisions — mirror that here so
      // the 5.5 activation checklist reads a truthful source match.
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      proposedSupervisorId: "e2e_user_shelter",
      proposedSchedule: "Tue/Thu afternoons",
      approvedAt: new Date(),
      approvedByUserId: "e2e_user_ops",
    },
  });
  await prisma.placement.create({
    data: {
      id: "e2e_placement_participant",
      placementNumber: "PLC-E2E-PARKER1",
      participantId: "e2e_participant_main",
      programEnrollmentId: "e2e_enrollment_participant",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      sourceMatchId: "e2e_match_placement_src",
      status: "ONBOARDING",
      supervisorId: "e2e_user_shelter",
      schedule: "Tue/Thu afternoons",
      startDate: new Date("2026-08-10T00:00:00Z"),
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_participant",
      fromStatus: null,
      toStatus: "DRAFT",
      actorUserId: "e2e_user_ops",
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_participant",
      fromStatus: "APPROVED",
      toStatus: "ONBOARDING",
      actorUserId: "e2e_user_ops",
    },
  });
  // Parker's own placement-onboarding step (Story 5.4): reset each run so
  // the participant completes it end-to-end from My Placement.
  await prisma.onboardingTask.create({
    data: {
      id: "e2e_ptask_parker_safety",
      placementId: "e2e_placement_participant",
      title: "Acknowledge the site safety procedures",
      description:
        "Confirm you've received and understood this site's safety walkthrough.",
      required: true,
      participantCompletable: true,
      sortOrder: 1,
    },
  });

  // Placement-assignment fixture (Story 5.2): CASEY carries a fresh DRAFT
  // placement each run for the assign -> propose -> shelter-review ->
  // approve E2E cycle. No Clerk identity — staff act on it.
  await prisma.user.upsert({
    where: { id: "e2e_user_assignready" },
    update: {},
    create: {
      id: "e2e_user_assignready",
      email: "e2e-assignready-subject@synthetic.example",
      displayName: "Synthetic Assignready Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_assignready" },
    update: {},
    create: {
      id: "e2e_person_assignready",
      userId: "e2e_user_assignready",
      legalFirstName: "Casey",
      legalLastName: "Synthetic-Assign",
      dateOfBirth: new Date("1994-04-04T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_assignready" },
    update: {},
    create: {
      id: "e2e_app_assignready",
      personId: "e2e_person_assignready",
      applicationNumber: "APP-E2E-ASSIGN1",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_assignready" },
    update: {},
    create: { id: "e2e_participant_assignready", personId: "e2e_person_assignready" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_assignready" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "e2e_enrollment_assignready",
      participantId: "e2e_participant_assignready",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_assignready",
      status: "READY_FOR_MATCHING",
    },
  });
  // Casey's completed required training (ADR-017 Layer 1): the E2E-RDY
  // program requires Core Readiness Training, and the 5.5/5.6 journey
  // needs Casey's Layer 1 already satisfied — the E2E exercises the
  // placement-side blockers (site checklist, funding), not Epic 3's.
  await prisma.trainingEnrollment.upsert({
    where: { id: "e2e_trainenroll_assignready" },
    update: { status: "COMPLETED" },
    create: {
      id: "e2e_trainenroll_assignready",
      programEnrollmentId: "e2e_enrollment_assignready",
      trainingProgramId: "e2e_training_readiness",
      status: "COMPLETED",
      enrolledAt: new Date("2026-06-01T00:00:00Z"),
      startedAt: new Date("2026-06-01T00:00:00Z"),
      completedAt: new Date("2026-06-20T00:00:00Z"),
      completionMethod: "PROVIDER_VERIFICATION",
      completionVerifiedByUserId: "e2e_user_ops",
      completionVerifiedAt: new Date("2026-06-20T00:00:00Z"),
    },
  });
  // Funding assignments before placements (RESTRICT) — the 5.6 journey
  // assigns funding to Casey's placement each run.
  await prisma.fundingAssignment.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  // Evaluations (Story 5.10) — the journey's supervisor submits one on
  // Casey's placement each run.
  await prisma.evaluation.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  // Incidents (Story 5.11) — follow-ups, then incidents, before placements.
  await prisma.incidentFollowUp.deleteMany({
    where: {
      incident: { placement: { participantId: "e2e_participant_assignready" } },
    },
  });
  await prisma.incident.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  // Employment outcomes (Story 5.8) before placements — the journey ends
  // Casey's placement each run.
  await prisma.employmentOutcome.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  await prisma.onboardingTask.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  await prisma.placementScheduleDay.deleteMany({
    where: {
      schedule: { placement: { participantId: "e2e_participant_assignready" } },
    },
  });
  await prisma.placementSchedule.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_assignready" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_assignready" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_assignready" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_assignready" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_assign_src",
      participantId: "e2e_participant_assignready",
      programEnrollmentId: "e2e_enrollment_assignready",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "APPROVED",
      // Both decisions recorded, as a real 4.8 approval requires — the
      // 5.5/5.6 journey drives Casey's blockers to empty and activates.
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: "e2e_user_ops",
    },
  });
  await prisma.placement.create({
    data: {
      id: "e2e_placement_assign",
      placementNumber: "PLC-E2E-CASEY01",
      participantId: "e2e_participant_assignready",
      programEnrollmentId: "e2e_enrollment_assignready",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      sourceMatchId: "e2e_match_assign_src",
      status: "DRAFT",
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_assign",
      fromStatus: null,
      toStatus: "DRAFT",
      actorUserId: "e2e_user_ops",
    },
  });

  // Conversion fixture (Story 5.8): ROWAN carries an ACTIVE placement so
  // the Record Permanent Hire E2E can convert it and see the Employment
  // Outcome. Own participant chain — the one-active-placement index bars
  // reusing Parker (ONBOARDING) or Casey (journey-owned). Reset each run.
  await prisma.user.upsert({
    where: { id: "e2e_user_convertready" },
    update: {},
    create: {
      id: "e2e_user_convertready",
      email: "e2e-convertready-subject@synthetic.example",
      displayName: "Synthetic Convertready Subject",
      isSynthetic: true,
    },
  });
  await prisma.person.upsert({
    where: { userId: "e2e_user_convertready" },
    update: {},
    create: {
      id: "e2e_person_convertready",
      userId: "e2e_user_convertready",
      legalFirstName: "Rowan",
      legalLastName: "Synthetic-Convert",
      dateOfBirth: new Date("1996-06-06T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_convertready" },
    update: {},
    create: {
      id: "e2e_app_convertready",
      personId: "e2e_person_convertready",
      applicationNumber: "APP-E2E-CONVERT1",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_convertready" },
    update: {},
    create: {
      id: "e2e_participant_convertready",
      personId: "e2e_person_convertready",
    },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_convertready" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "e2e_enrollment_convertready",
      participantId: "e2e_participant_convertready",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_convertready",
      status: "READY_FOR_MATCHING",
    },
  });
  await prisma.employmentOutcome.deleteMany({
    where: { placement: { participantId: "e2e_participant_convertready" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_convertready" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_convertready" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_convertready" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_convertready" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_convert_src",
      participantId: "e2e_participant_convertready",
      programEnrollmentId: "e2e_enrollment_convertready",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "APPROVED",
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: "e2e_user_ops",
    },
  });
  await prisma.placement.create({
    data: {
      id: "e2e_placement_convert",
      placementNumber: "PLC-E2E-ROWAN01",
      participantId: "e2e_participant_convertready",
      programEnrollmentId: "e2e_enrollment_convertready",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      sourceMatchId: "e2e_match_convert_src",
      status: "ACTIVE",
      supervisorId: "e2e_user_shelter",
      schedule: "Mon/Wed mornings",
      startDate: new Date("2026-07-01T00:00:00Z"),
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_convert",
      fromStatus: null,
      toStatus: "DRAFT",
      actorUserId: "e2e_user_ops",
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_convert",
      fromStatus: "ONBOARDING",
      toStatus: "ACTIVE",
      actorUserId: "e2e_user_ops",
    },
  });

  // My Hours fixture (Story 6.1): HARPER — the second Clerk participant
  // login — holds an ACTIVE placement so timesheets are E2E-testable
  // without disturbing Parker's ONBOARDING fixture. Timesheets reset each
  // run; the placement is recreated ACTIVE with a start date in the past
  // so prior-week navigation has room.
  await prisma.person.upsert({
    where: { userId: "e2e_user_hours" },
    update: {},
    create: {
      id: "e2e_person_hours",
      userId: "e2e_user_hours",
      legalFirstName: "Harper",
      legalLastName: "Synthetic-Hours",
      dateOfBirth: new Date("1998-08-08T00:00:00Z"),
    },
  });
  await prisma.application.upsert({
    where: { id: "e2e_app_hours" },
    update: {},
    create: {
      id: "e2e_app_hours",
      personId: "e2e_person_hours",
      applicationNumber: "APP-E2E-HOURS01",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
  await prisma.participant.upsert({
    where: { personId: "e2e_person_hours" },
    update: {},
    create: { id: "e2e_participant_hours", personId: "e2e_person_hours" },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "e2e_app_hours" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "e2e_enrollment_hours",
      participantId: "e2e_participant_hours",
      programId: "e2e_program_readiness",
      applicationId: "e2e_app_hours",
      status: "READY_FOR_MATCHING",
    },
  });
  // Work entries (Story 6.2), then events, then the timesheets — every
  // child before its RESTRICT-protected parent.
  await prisma.workEntry.deleteMany({
    where: {
      timesheet: { placement: { participantId: "e2e_participant_hours" } },
    },
  });
  await prisma.timesheetEvent.deleteMany({
    where: {
      timesheet: { placement: { participantId: "e2e_participant_hours" } },
    },
  });
  await prisma.timesheet.deleteMany({
    where: { placement: { participantId: "e2e_participant_hours" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "e2e_participant_hours" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "e2e_participant_hours" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "e2e_participant_hours" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "e2e_participant_hours" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "e2e_match_hours_src",
      participantId: "e2e_participant_hours",
      programEnrollmentId: "e2e_enrollment_hours",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      status: "APPROVED",
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: "e2e_user_ops",
    },
  });
  await prisma.placement.create({
    data: {
      id: "e2e_placement_hours",
      placementNumber: "PLC-E2E-HARPER1",
      participantId: "e2e_participant_hours",
      programEnrollmentId: "e2e_enrollment_hours",
      hostOrganizationId: "e2e_org_shelter",
      organizationSiteId: "e2e_site_shelter",
      sourceMatchId: "e2e_match_hours_src",
      status: "ACTIVE",
      supervisorId: "e2e_user_shelter",
      schedule: "Tue/Thu mornings",
      startDate: new Date("2026-06-01T00:00:00Z"),
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_hours",
      fromStatus: null,
      toStatus: "DRAFT",
      actorUserId: "e2e_user_ops",
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "e2e_placement_hours",
      fromStatus: "ONBOARDING",
      toStatus: "ACTIVE",
      actorUserId: "e2e_user_ops",
    },
  });

  // Targeted cleanup of rows created by PREVIOUS funding E2E runs (ADR-006:
  // clean only our own synthetic test rows, never truncate). Sources that
  // gained funding assignments (Story 5.3) are RESTRICT-protected and
  // excluded — assignment history is never deleted.
  const cleaned = await prisma.fundingSource.deleteMany({
    where: { name: { startsWith: "E2E Synthetic" }, assignments: { none: {} } },
  });
  // Funding-assignment fixture (Story 5.3): a deterministic grant source
  // (outside the cleanup prefix above) and a per-run reset of PARKER's
  // assignments so the Grant Administrator E2E starts unassigned.
  await prisma.fundingSource.upsert({
    where: { id: "e2e_funding_grant" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "e2e_funding_grant",
      name: "E2E Grant Fund (Synthetic)",
      kind: FundingSourceKind.GRANT,
      code: "E2E-GRANT",
      status: ActiveStatus.ACTIVE,
    },
  });

  console.log(
    `E2E fixtures ready (${FIXTURE_USERS.length + 2} Clerk users, 2 organizations, ` +
      `2 operations applications; applicants reset; ${cleaned.count} prior funding fixtures cleaned).`,
  );
} finally {
  await prisma.$disconnect();
}
