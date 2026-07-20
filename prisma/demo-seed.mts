// @next/env is CommonJS — use default-import interop under ESM.
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  ActiveStatus,
  ApplicationStatus,
  FundingSourceKind,
  InterviewFormat,
  OnboardingTaskStatus,
  OrganizationKind,
  Role,
} from "../src/generated/prisma/enums";

/**
 * Demo-day seed (2026-07): five signable demo accounts (shared password)
 * plus a realistic, self-contained demo world so every role's dashboard
 * has real-looking content for demo-day attendees.
 *
 * Run:  DEMO_SEED_CONFIRM=yes npx tsx prisma/demo-seed.mts
 *
 * - Targets whatever DATABASE_URL + CLERK_SECRET_KEY are loaded — the
 *   nonprod stack by default; the production run is a deliberate,
 *   Kit-approved ADR-006 exception recorded in DECISIONS.md and
 *   docs/ops/demo-day.md.
 * - Idempotent on deterministic demo_* ids: RE-RUNNING IS THE RESET
 *   BUTTON between demo sessions. It restores canonical statuses,
 *   deletes derivative rows attendee actions created, and re-forces
 *   each demo account's Clerk password.
 * - Every row is isSynthetic where the model supports it, and every id
 *   carries the demo_ prefix, so one future cleanup can remove the lot
 *   (fictional data — ADR-021's counsel gate governs participant data,
 *   not this).
 * - Demo staff live in demo-only organizations. Shelter queries are
 *   host-org-scoped, so the shelter login sees only demo records.
 *   Nova-side queries are permission-gated but not org-partitioned
 *   (by design — one program), so ops/grants/admin see whatever else
 *   the target database holds; the prod go/no-go census accounts for
 *   this before any production run.
 */
nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

if (process.env.DEMO_SEED_CONFIRM !== "yes") {
  throw new Error(
    "Refusing to run: set DEMO_SEED_CONFIRM=yes (deliberate speed bump — " +
      "this script writes demo accounts and data to the target database).",
  );
}
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required to provision demo sign-ins");
}

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "NovaDemo2026!";

interface DemoAccount {
  email: string;
  internalId: string;
  firstName: string;
  lastName: string;
  membership: { organizationId: string; role: Role } | null;
}

/** The five sign-in-able demo-day accounts (docs/ops/demo-day.md). */
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "participant@project-nova.app",
    internalId: "demo_user_katie",
    firstName: "Katie",
    lastName: "Sullivan",
    // The PARTICIPANT role membership grants timesheet.create etc. —
    // without it My Hours throws and the home shows the applicant card.
    membership: { organizationId: "demo_org_nova", role: Role.PARTICIPANT },
  },
  {
    email: "ops@project-nova.app",
    internalId: "demo_user_ops",
    firstName: "Marcus",
    lastName: "Webb",
    membership: { organizationId: "demo_org_nova", role: Role.PROGRAM_COORDINATOR },
  },
  {
    email: "shelter@project-nova.app",
    internalId: "demo_user_shelter",
    firstName: "Priya",
    lastName: "Natarajan",
    membership: { organizationId: "demo_org_shelter", role: Role.SHELTER_MANAGER },
  },
  {
    email: "grants@project-nova.app",
    internalId: "demo_user_grants",
    firstName: "Eleanor",
    lastName: "Park",
    membership: { organizationId: "demo_org_nova", role: Role.GRANT_ADMINISTRATOR },
  },
  {
    email: "admin@project-nova.app",
    internalId: "demo_user_admin",
    firstName: "Jordan",
    lastName: "Avery",
    membership: { organizationId: "demo_org_nova", role: Role.NOVA_ADMINISTRATOR },
  },
];

/**
 * Ensure a Clerk user exists with the demo password, FORCE the password
 * back to the demo value (an attendee may have changed it), and set the
 * display name. Returns the Clerk user id.
 */
async function ensureClerkDemoUser(
  email: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const createResponse = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password: DEMO_PASSWORD,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
    }),
  });
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

  // Reset semantics: force the canonical password + names on every run.
  const update = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: DEMO_PASSWORD,
      skip_password_checks: true,
      first_name: firstName,
      last_name: lastName,
    }),
  });
  if (!update.ok) {
    throw new Error(`Failed to reset Clerk user ${email} (${update.status})`);
  }
  return clerkUserId;
}

/** Monday 00:00 UTC of the week containing `date`, offset by `weeks`. */
function weekStart(date: Date, weeks: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7) + weeks * 7);
  return d;
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const now = new Date();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

try {
  // ---------------------------------------------------------------- Orgs
  await prisma.organization.upsert({
    where: { id: "demo_org_nova" },
    update: { name: "Project Nova (Demo)" },
    create: {
      id: "demo_org_nova",
      name: "Project Nova (Demo)",
      kind: OrganizationKind.NOVA,
      isSynthetic: true,
    },
  });
  await prisma.organization.upsert({
    where: { id: "demo_org_shelter" },
    update: { name: "Front Range Animal Rescue (Demo)" },
    create: {
      id: "demo_org_shelter",
      name: "Front Range Animal Rescue (Demo)",
      kind: OrganizationKind.HOST,
      isSynthetic: true,
    },
  });
  await prisma.organization.upsert({
    where: { id: "demo_org_shelter2" },
    update: { name: "Boulder Valley Humane Society (Demo)" },
    create: {
      id: "demo_org_shelter2",
      name: "Boulder Valley Humane Society (Demo)",
      kind: OrganizationKind.HOST,
      isSynthetic: true,
    },
  });
  await prisma.organizationSite.upsert({
    where: { id: "demo_site_frontrange" },
    update: { status: ActiveStatus.ACTIVE, capacity: 4 },
    create: {
      id: "demo_site_frontrange",
      organizationId: "demo_org_shelter",
      name: "Front Range Rescue — Main Campus",
      city: "Fort Collins",
      region: "CO",
      capacity: 4,
    },
  });
  await prisma.organizationSite.upsert({
    where: { id: "demo_site_boulder" },
    update: { status: ActiveStatus.ACTIVE, capacity: 2 },
    create: {
      id: "demo_site_boulder",
      organizationId: "demo_org_shelter2",
      name: "Boulder Valley Adoption Center",
      city: "Boulder",
      region: "CO",
      capacity: 2,
    },
  });

  // ------------------------------------------- Reference data (shared ids)
  await prisma.program.upsert({
    where: { code: "NOVA-TE" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "program_nova_te",
      code: "NOVA-TE",
      name: "Transitional Employment Program",
    },
  });
  const program = await prisma.program.findUniqueOrThrow({ where: { code: "NOVA-TE" } });

  // ------------------------------------------------- Demo sign-in accounts
  for (const account of DEMO_ACCOUNTS) {
    const clerkUserId = await ensureClerkDemoUser(
      account.email,
      account.firstName,
      account.lastName,
    );
    // A row may already exist under this email (e.g. provision-on-first-
    // sign-in ran before the seed) — converge on it rather than colliding.
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    const displayName = `${account.firstName} ${account.lastName}`;
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { clerkUserId, displayName, isSynthetic: true },
        })
      : await prisma.user.create({
          data: {
            id: account.internalId,
            clerkUserId,
            email: account.email,
            displayName,
            isSynthetic: true,
          },
        });
    if (account.membership) {
      await prisma.membership.upsert({
        where: {
          userId_organizationId_role: {
            userId: user.id,
            organizationId: account.membership.organizationId,
            role: account.membership.role,
          },
        },
        update: { status: ActiveStatus.ACTIVE, deactivatedAt: null },
        create: {
          userId: user.id,
          organizationId: account.membership.organizationId,
          role: account.membership.role,
        },
      });
    }
  }
  const katieUserId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "participant@project-nova.app" } })
  ).id;
  const opsUserId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "ops@project-nova.app" } })
  ).id;
  const shelterUserId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "shelter@project-nova.app" } })
  ).id;
  const grantsUserId = (
    await prisma.user.findUniqueOrThrow({ where: { email: "grants@project-nova.app" } })
  ).id;

  // ------------------------------------------------ Internal demo people
  // Non-signable people who fill queues, rosters, and reports. Deliberately
  // varied, realistic-but-fictional names; emails are obviously synthetic.
  async function ensureDemoPerson(
    slug: string,
    firstName: string,
    lastName: string,
    dob: string,
  ): Promise<{ userId: string; personId: string }> {
    const user = await prisma.user.upsert({
      where: { id: `demo_user_${slug}` },
      update: {},
      create: {
        id: `demo_user_${slug}`,
        email: `demo-${slug}@synthetic.example`,
        displayName: `${firstName} ${lastName}`,
        isSynthetic: true,
      },
    });
    await prisma.person.upsert({
      where: { userId: user.id },
      update: { disqualifiedAt: null },
      create: {
        id: `demo_person_${slug}`,
        userId: user.id,
        legalFirstName: firstName,
        legalLastName: lastName,
        dateOfBirth: new Date(dob),
      },
    });
    return { userId: user.id, personId: `demo_person_${slug}` };
  }

  interface DemoApplication {
    slug: string;
    firstName: string;
    lastName: string;
    dob: string;
    number: string;
    status: ApplicationStatus;
    submittedDaysAgo: number;
    motivation: string;
  }

  const PIPELINE_APPS: DemoApplication[] = [
    {
      slug: "jordanm",
      firstName: "Jordan",
      lastName: "Mills",
      dob: "1993-02-14T00:00:00Z",
      number: "APP-2026-0341",
      status: ApplicationStatus.SUBMITTED,
      submittedDaysAgo: 2,
      motivation:
        "I grew up around dogs and I do my best work when someone is counting on me. I want steady work where I can rebuild a record I am proud of.",
    },
    {
      slug: "samo",
      firstName: "Sam",
      lastName: "Okafor",
      dob: "1988-09-30T00:00:00Z",
      number: "APP-2026-0342",
      status: ApplicationStatus.SUBMITTED,
      submittedDaysAgo: 4,
      motivation:
        "A friend who finished this program told me it was the first job in years where he felt trusted. I would like that chance too.",
    },
    {
      slug: "reneec",
      firstName: "Renee",
      lastName: "Castillo",
      dob: "1996-06-08T00:00:00Z",
      number: "APP-2026-0344",
      status: ApplicationStatus.SUBMITTED,
      submittedDaysAgo: 6,
      motivation:
        "I volunteered in the kennels before my time away and it was the calmest I have ever felt at work. I am ready to start again from the bottom.",
    },
    {
      slug: "tyrellw",
      firstName: "Tyrell",
      lastName: "Washington",
      dob: "1991-11-22T00:00:00Z",
      number: "APP-2026-0338",
      status: ApplicationStatus.ELIGIBILITY_REVIEW,
      submittedDaysAgo: 9,
      motivation:
        "I have two years of warehouse experience and a certificate in forklift operation. Animals are new to me, but hard work is not.",
    },
    {
      slug: "mayat",
      firstName: "Maya",
      lastName: "Thompson",
      dob: "1994-04-03T00:00:00Z",
      number: "APP-2026-0332",
      status: ApplicationStatus.INTERVIEW,
      submittedDaysAgo: 13,
      motivation:
        "I kept the library cart running inside and I am good with routines. I want work where showing up every day matters to someone.",
    },
    {
      slug: "colen",
      firstName: "Cole",
      lastName: "Novak",
      dob: "1990-07-19T00:00:00Z",
      number: "APP-2026-0329",
      status: ApplicationStatus.BACKGROUND_REVIEW,
      submittedDaysAgo: 16,
      motivation:
        "My counselor suggested this program because I have talked about wanting to work with animals for years. I am ready to prove it.",
    },
  ];

  for (const app of PIPELINE_APPS) {
    const { personId } = await ensureDemoPerson(app.slug, app.firstName, app.lastName, app.dob);
    // Reset any derivative rows attendee actions may have created.
    await prisma.eligibilityReview.deleteMany({
      where: { applicationId: `demo_app_${app.slug}` },
    });
    await prisma.backgroundReview.deleteMany({
      where: { applicationId: `demo_app_${app.slug}` },
    });
    await prisma.interview.deleteMany({ where: { applicationId: `demo_app_${app.slug}` } });
    await prisma.applicationEvent.deleteMany({
      where: { applicationId: `demo_app_${app.slug}` },
    });
    await prisma.application.upsert({
      where: { id: `demo_app_${app.slug}` },
      update: {
        status: app.status,
        submittedAt: addDays(now, -app.submittedDaysAgo),
        decidedAt: null,
        decisionReason: null,
      },
      create: {
        id: `demo_app_${app.slug}`,
        personId,
        applicationNumber: app.number,
        status: app.status,
        submittedAt: addDays(now, -app.submittedDaysAgo),
        motivation: app.motivation,
        workExperience: "Shared during intake conversation.",
        animalExperience: "Shared during intake conversation.",
        availabilityNotes: "Weekdays, mornings preferred.",
        transportationNotes: "Bus line access confirmed.",
      },
    });
  }

  // Maya's interview is on the calendar (with one reschedule behind it).
  await prisma.interview.create({
    data: {
      applicationId: "demo_app_mayat",
      scheduledAt: addDays(now, 3),
      format: InterviewFormat.VIRTUAL,
      interviewerId: opsUserId,
      notes: "Rescheduled from last week at Maya's request — bus schedule conflict.",
    },
  });

  // ------------------------------------------------------- Katie Sullivan
  // The star of the demo: a complete journey into an ACTIVE placement.
  await prisma.person.upsert({
    where: { userId: katieUserId },
    update: { disqualifiedAt: null },
    create: {
      id: "demo_person_katie",
      userId: katieUserId,
      legalFirstName: "Katie",
      legalLastName: "Sullivan",
      dateOfBirth: new Date("1992-03-27T00:00:00Z"),
    },
  });
  const katiePerson = await prisma.person.findUniqueOrThrow({
    where: { userId: katieUserId },
  });
  await prisma.application.upsert({
    where: { id: "demo_app_katie" },
    update: { status: ApplicationStatus.ACCEPTED },
    create: {
      id: "demo_app_katie",
      personId: katiePerson.id,
      applicationNumber: "APP-2026-0286",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: addDays(now, -68),
      decidedAt: addDays(now, -55),
      motivation:
        "I want work I can be proud of while I get back on my feet, and animals have always been the thing that steadies me.",
      workExperience: "Food service before, kitchen crew lead for one year inside.",
      animalExperience: "Grew up fostering litters with my aunt.",
      availabilityNotes: "Mon/Wed/Fri, mornings best.",
      transportationNotes: "Has a reliable ride share arrangement.",
    },
  });
  await prisma.participant.upsert({
    where: { personId: katiePerson.id },
    update: {},
    create: { id: "demo_participant_katie", personId: katiePerson.id },
  });
  // Katie's enrollment stays ONBOARDING (all tasks complete): the
  // participant home's progress tiles only render for ONBOARDING
  // enrollments today (getOwnOnboardingSummary filters on it), and her
  // placement/hours pages read the placement directly regardless.
  await prisma.programEnrollment.upsert({
    where: { applicationId: "demo_app_katie" },
    update: { status: "ONBOARDING" },
    create: {
      id: "demo_enrollment_katie",
      participantId: "demo_participant_katie",
      programId: program.id,
      applicationId: "demo_app_katie",
      status: "ONBOARDING",
    },
  });
  // Onboarding fully complete (mirrors the NOVA-TE template catalog).
  const KATIE_TASKS = [
    { id: "demo_task_katie_01", title: "Attend orientation session", sortOrder: 1 },
    { id: "demo_task_katie_02", title: "Complete employment paperwork", sortOrder: 2 },
    { id: "demo_task_katie_03", title: "Set up direct deposit or pay card", sortOrder: 3 },
    { id: "demo_task_katie_04", title: "Add an emergency contact", sortOrder: 4 },
    { id: "demo_task_katie_05", title: "Review the program handbook", sortOrder: 5 },
  ];
  for (const [index, task] of KATIE_TASKS.entries()) {
    await prisma.onboardingTask.upsert({
      where: { id: task.id },
      update: {
        status: OnboardingTaskStatus.COMPLETE,
        completedAt: addDays(now, -50 + index * 2),
        completedByUserId: index < 2 ? opsUserId : katieUserId,
      },
      create: {
        id: task.id,
        enrollmentId: "demo_enrollment_katie",
        title: task.title,
        description: "Completed during Katie's onboarding.",
        required: true,
        participantCompletable: index >= 2,
        sortOrder: task.sortOrder,
        status: OnboardingTaskStatus.COMPLETE,
        completedAt: addDays(now, -50 + index * 2),
        completedByUserId: index < 2 ? opsUserId : katieUserId,
      },
    });
  }
  // Training: two completed (with certifications), one in progress.
  const KATIE_TRAINING = [
    {
      id: "demo_training_katie_readiness",
      trainingProgramId: "nova_te_training_workplace_readiness",
      status: "COMPLETED",
      startedDaysAgo: 52,
      completedDaysAgo: 45,
    },
    {
      id: "demo_training_katie_handling",
      trainingProgramId: "nova_te_training_animal_handling",
      status: "COMPLETED",
      startedDaysAgo: 45,
      completedDaysAgo: 38,
    },
    {
      id: "demo_training_katie_sanitation",
      trainingProgramId: "nova_te_training_sanitation",
      status: "IN_PROGRESS",
      startedDaysAgo: 20,
      completedDaysAgo: null,
    },
  ] as const;
  for (const training of KATIE_TRAINING) {
    await prisma.trainingEnrollment.upsert({
      where: { id: training.id },
      update: { status: training.status },
      create: {
        id: training.id,
        programEnrollmentId: "demo_enrollment_katie",
        trainingProgramId: training.trainingProgramId,
        status: training.status,
        enrolledAt: addDays(now, -training.startedDaysAgo - 2),
        startedAt: addDays(now, -training.startedDaysAgo),
        completedAt:
          training.completedDaysAgo === null ? null : addDays(now, -training.completedDaysAgo),
        providerName: "Project Nova Training",
        // The status check constraint: COMPLETED requires method + verifier.
        completionMethod:
          training.completedDaysAgo === null ? null : "KNOWLEDGE_ASSESSMENT",
        completionVerifiedByUserId:
          training.completedDaysAgo === null ? null : opsUserId,
        completionVerifiedAt:
          training.completedDaysAgo === null ? null : addDays(now, -training.completedDaysAgo),
      },
    });
  }
  await prisma.certification.deleteMany({
    where: { participantId: "demo_participant_katie" },
  });
  await prisma.certification.createMany({
    data: [
      {
        participantId: "demo_participant_katie",
        name: "Workplace Readiness & Communication",
        issuer: "Project Nova Training",
        issuedOn: addDays(now, -45),
        requiredForMatching: true,
      },
      {
        participantId: "demo_participant_katie",
        name: "Animal Handling & Bite Prevention Foundations",
        issuer: "Project Nova Training",
        issuedOn: addDays(now, -38),
        requiredForMatching: true,
      },
    ],
  });

  // Katie's ACTIVE placement at Front Range (children first on reset).
  await prisma.fundingAssignment.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.caseNoteRevision.deleteMany({
    where: { caseNote: { placement: { participantId: "demo_participant_katie" } } },
  });
  await prisma.caseNote.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.workEntry.deleteMany({
    where: { timesheet: { placement: { participantId: "demo_participant_katie" } } },
  });
  await prisma.timesheet.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.incident.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.onboardingTask.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "demo_participant_katie" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "demo_participant_katie" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "demo_participant_katie" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "demo_participant_katie" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "demo_match_katie",
      participantId: "demo_participant_katie",
      programEnrollmentId: "demo_enrollment_katie",
      hostOrganizationId: "demo_org_shelter",
      organizationSiteId: "demo_site_frontrange",
      status: "APPROVED",
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      proposedSupervisorId: shelterUserId,
      proposedSchedule: "Mon/Wed/Fri mornings",
      approvedAt: addDays(now, -36),
      approvedByUserId: opsUserId,
    },
  });
  await prisma.placement.create({
    data: {
      id: "demo_placement_katie",
      placementNumber: "PLC-2026-0107",
      participantId: "demo_participant_katie",
      programEnrollmentId: "demo_enrollment_katie",
      hostOrganizationId: "demo_org_shelter",
      organizationSiteId: "demo_site_frontrange",
      sourceMatchId: "demo_match_katie",
      status: "ACTIVE",
      supervisorId: shelterUserId,
      schedule: "Mon/Wed/Fri mornings",
      startDate: addDays(now, -34),
    },
  });
  for (const [fromStatus, toStatus, daysAgo] of [
    [null, "DRAFT", 36],
    ["APPROVED", "ONBOARDING", 35],
    ["ONBOARDING", "ACTIVE", 34],
  ] as const) {
    await prisma.placementEvent.create({
      data: {
        placementId: "demo_placement_katie",
        fromStatus,
        toStatus,
        actorUserId: opsUserId,
        createdAt: addDays(now, -daysAgo),
      },
    });
  }

  // Katie's weekly hours: LOCKED, LOCKED, APPROVED, SUBMITTED, DRAFT.
  const KATIE_WEEKS = [
    { offset: -4, status: "LOCKED", days: [4.5, 4.5, 4.0] },
    { offset: -3, status: "LOCKED", days: [4.5, 4.0, 4.5] },
    { offset: -2, status: "APPROVED", days: [4.0, 4.5, 4.5] },
    { offset: -1, status: "SUBMITTED", days: [4.5, 4.5, 4.0] },
    { offset: 0, status: "DRAFT", days: [4.5, 4.0] },
  ] as const;
  for (const week of KATIE_WEEKS) {
    const start = weekStart(now, week.offset);
    const total = week.days.reduce((sum, h) => sum + h, 0).toFixed(2);
    const timesheet = await prisma.timesheet.create({
      data: {
        id: `demo_ts_katie_${week.offset + 5}`,
        placementId: "demo_placement_katie",
        weekStartDate: start,
        weekEndDate: addDays(start, 6),
        status: week.status,
        totalHours: total,
        submittedAt: week.status === "DRAFT" ? null : addDays(start, 5),
        approvedAt:
          week.status === "APPROVED" || week.status === "LOCKED" ? addDays(start, 6) : null,
        approvedByUserId:
          week.status === "APPROVED" || week.status === "LOCKED" ? shelterUserId : null,
        lockedAt: week.status === "LOCKED" ? addDays(start, 7) : null,
        lockedByUserId: week.status === "LOCKED" ? opsUserId : null,
      },
    });
    for (const [index, hours] of week.days.entries()) {
      await prisma.workEntry.create({
        data: {
          timesheetId: timesheet.id,
          workDate: addDays(start, index * 2), // Mon/Wed/Fri rhythm
          startTime: "08:30",
          endTime: index % 2 === 0 ? "13:00" : "12:30",
          breakMinutes: 0,
          hours: hours.toFixed(2),
          note: index === 0 ? "Kennel care and morning feeding" : "Adoption-area support",
        },
      });
    }
  }

  // ------------------------------------- Placements around the demo world
  interface DemoPlaced {
    slug: string;
    firstName: string;
    lastName: string;
    dob: string;
    appNumber: string;
    placementNumber: string;
    orgId: string;
    siteId: string;
    status: "ACTIVE" | "ONBOARDING" | "CONVERTED_TO_PERMANENT";
    startDaysAgo: number;
    endDaysAgo?: number;
  }
  const PLACED: DemoPlaced[] = [
    {
      slug: "devonteh",
      firstName: "Devonte",
      lastName: "Harris",
      dob: "1989-12-02T00:00:00Z",
      appNumber: "APP-2026-0270",
      placementNumber: "PLC-2026-0101",
      orgId: "demo_org_shelter",
      siteId: "demo_site_frontrange",
      status: "ACTIVE",
      startDaysAgo: 48,
    },
    {
      slug: "alician",
      firstName: "Alicia",
      lastName: "Nguyen",
      dob: "1995-05-16T00:00:00Z",
      appNumber: "APP-2026-0264",
      placementNumber: "PLC-2026-0098",
      orgId: "demo_org_shelter2",
      siteId: "demo_site_boulder",
      status: "ACTIVE",
      startDaysAgo: 55,
    },
    {
      slug: "marcusb",
      firstName: "Marcus",
      lastName: "Bell",
      dob: "1992-08-25T00:00:00Z",
      appNumber: "APP-2026-0301",
      placementNumber: "PLC-2026-0112",
      orgId: "demo_org_shelter",
      siteId: "demo_site_frontrange",
      status: "ONBOARDING", // blocked at activation — the ops urgent tile
      startDaysAgo: 12,
    },
    {
      slug: "gracew",
      firstName: "Grace",
      lastName: "Whitfield",
      dob: "1987-01-09T00:00:00Z",
      appNumber: "APP-2026-0221",
      placementNumber: "PLC-2026-0074",
      orgId: "demo_org_shelter",
      siteId: "demo_site_frontrange",
      status: "CONVERTED_TO_PERMANENT", // the outcome-summary star
      startDaysAgo: 150,
      endDaysAgo: 21,
    },
  ];
  for (const placed of PLACED) {
    const { personId } = await ensureDemoPerson(
      placed.slug,
      placed.firstName,
      placed.lastName,
      placed.dob,
    );
    await prisma.application.upsert({
      where: { id: `demo_app_${placed.slug}` },
      update: { status: ApplicationStatus.ACCEPTED },
      create: {
        id: `demo_app_${placed.slug}`,
        personId,
        applicationNumber: placed.appNumber,
        status: ApplicationStatus.ACCEPTED,
        submittedAt: addDays(now, -placed.startDaysAgo - 30),
        decidedAt: addDays(now, -placed.startDaysAgo - 20),
      },
    });
    await prisma.participant.upsert({
      where: { personId },
      update: {},
      create: { id: `demo_participant_${placed.slug}`, personId },
    });
    await prisma.programEnrollment.upsert({
      where: { applicationId: `demo_app_${placed.slug}` },
      update: { status: "READY_FOR_MATCHING" },
      create: {
        id: `demo_enrollment_${placed.slug}`,
        participantId: `demo_participant_${placed.slug}`,
        programId: program.id,
        applicationId: `demo_app_${placed.slug}`,
        status: "READY_FOR_MATCHING",
      },
    });
    // Reset children, then rebuild the match + placement pair.
    await prisma.fundingAssignment.deleteMany({
      where: { placement: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.workEntry.deleteMany({
      where: {
        timesheet: { placement: { participantId: `demo_participant_${placed.slug}` } },
      },
    });
    await prisma.timesheet.deleteMany({
      where: { placement: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.incident.deleteMany({
      where: { placement: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.onboardingTask.deleteMany({
      where: { placement: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.placementEvent.deleteMany({
      where: { placement: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.placement.deleteMany({
      where: { participantId: `demo_participant_${placed.slug}` },
    });
    await prisma.placementMatchEvent.deleteMany({
      where: { placementMatch: { participantId: `demo_participant_${placed.slug}` } },
    });
    await prisma.placementMatch.deleteMany({
      where: { participantId: `demo_participant_${placed.slug}` },
    });
    await prisma.placementMatch.create({
      data: {
        id: `demo_match_${placed.slug}`,
        participantId: `demo_participant_${placed.slug}`,
        programEnrollmentId: `demo_enrollment_${placed.slug}`,
        hostOrganizationId: placed.orgId,
        organizationSiteId: placed.siteId,
        status: "APPROVED",
        participantDecision: "ACCEPTED",
        shelterDecision: "APPROVED",
        proposedSupervisorId: shelterUserId,
        proposedSchedule: "Tue/Thu mornings",
        approvedAt: addDays(now, -placed.startDaysAgo - 2),
        approvedByUserId: opsUserId,
      },
    });
    await prisma.placement.create({
      data: {
        id: `demo_placement_${placed.slug}`,
        placementNumber: placed.placementNumber,
        participantId: `demo_participant_${placed.slug}`,
        programEnrollmentId: `demo_enrollment_${placed.slug}`,
        hostOrganizationId: placed.orgId,
        organizationSiteId: placed.siteId,
        sourceMatchId: `demo_match_${placed.slug}`,
        status: placed.status,
        supervisorId: shelterUserId,
        schedule: "Tue/Thu mornings",
        startDate: addDays(now, -placed.startDaysAgo),
        endDate: placed.endDaysAgo === undefined ? null : addDays(now, -placed.endDaysAgo),
      },
    });
    await prisma.placementEvent.create({
      data: {
        placementId: `demo_placement_${placed.slug}`,
        fromStatus: null,
        toStatus: "DRAFT",
        actorUserId: opsUserId,
        createdAt: addDays(now, -placed.startDaysAgo - 3),
      },
    });
  }

  // Marcus Bell is BLOCKED at activation: open required tasks, no funding.
  await prisma.onboardingTask.createMany({
    data: [
      {
        id: "demo_ptask_marcus_safety",
        placementId: "demo_placement_marcusb",
        title: "Host-site safety orientation",
        description: "Walkthrough with the site supervisor.",
        required: true,
        participantCompletable: false,
        sortOrder: 1,
      },
      {
        id: "demo_ptask_marcus_schedule",
        placementId: "demo_placement_marcusb",
        title: "Confirm weekly schedule",
        description: "Agree final days and times with the site.",
        required: true,
        participantCompletable: false,
        sortOrder: 2,
      },
    ],
  });

  // Devonte: a SUBMITTED week awaiting Priya (with Katie's, count = 2),
  // plus a LOCKED prior week for the reports.
  for (const week of [
    { offset: -2, status: "LOCKED", total: "9.00" },
    { offset: -1, status: "SUBMITTED", total: "8.50" },
  ] as const) {
    const start = weekStart(now, week.offset);
    await prisma.timesheet.create({
      data: {
        id: `demo_ts_devonte_${week.offset + 5}`,
        placementId: "demo_placement_devonteh",
        weekStartDate: start,
        weekEndDate: addDays(start, 6),
        status: week.status,
        totalHours: week.total,
        submittedAt: addDays(start, 5),
        approvedAt: week.status === "LOCKED" ? addDays(start, 6) : null,
        approvedByUserId: week.status === "LOCKED" ? shelterUserId : null,
        lockedAt: week.status === "LOCKED" ? addDays(start, 7) : null,
        lockedByUserId: week.status === "LOCKED" ? opsUserId : null,
      },
    });
  }
  // Alicia: two LOCKED weeks under the second funding source.
  for (const offset of [-3, -2] as const) {
    const start = weekStart(now, offset);
    await prisma.timesheet.create({
      data: {
        id: `demo_ts_alicia_${offset + 5}`,
        placementId: "demo_placement_alician",
        weekStartDate: start,
        weekEndDate: addDays(start, 6),
        status: "LOCKED",
        totalHours: "10.00",
        submittedAt: addDays(start, 5),
        approvedAt: addDays(start, 6),
        approvedByUserId: shelterUserId,
        lockedAt: addDays(start, 7),
        lockedByUserId: opsUserId,
      },
    });
  }

  // Grace earned certifications on her way out (outcome summary texture).
  await prisma.certification.deleteMany({
    where: { participantId: "demo_participant_gracew" },
  });
  await prisma.certification.create({
    data: {
      participantId: "demo_participant_gracew",
      name: "Shelter Operations Assistant",
      issuer: "Project Nova Training",
      issuedOn: addDays(now, -30),
    },
  });

  // ------------------------- The matching queue + shelter decision surface
  const { personId: rosaPersonId } = await ensureDemoPerson(
    "rosad",
    "Rosa",
    "Delgado",
    "1997-10-11T00:00:00Z",
  );
  await prisma.application.upsert({
    where: { id: "demo_app_rosad" },
    update: { status: ApplicationStatus.ACCEPTED },
    create: {
      id: "demo_app_rosad",
      personId: rosaPersonId,
      applicationNumber: "APP-2026-0312",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: addDays(now, -40),
      decidedAt: addDays(now, -28),
      availabilityNotes: "Weekday afternoons",
    },
  });
  await prisma.participant.upsert({
    where: { personId: rosaPersonId },
    update: {},
    create: { id: "demo_participant_rosad", personId: rosaPersonId },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "demo_app_rosad" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "demo_enrollment_rosad",
      participantId: "demo_participant_rosad",
      programId: program.id,
      applicationId: "demo_app_rosad",
      status: "READY_FOR_MATCHING",
    },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "demo_participant_rosad" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "demo_participant_rosad" },
  });
  const rosaProposedAt = addDays(now, -2);
  await prisma.placementMatch.create({
    data: {
      id: "demo_match_rosad",
      participantId: "demo_participant_rosad",
      programEnrollmentId: "demo_enrollment_rosad",
      hostOrganizationId: "demo_org_shelter",
      organizationSiteId: "demo_site_frontrange",
      status: "PROPOSED",
      proposedSupervisorId: shelterUserId,
      proposedSchedule: "Tue/Thu afternoons",
      proposedStartDate: addDays(now, 12),
      proposedEndDate: addDays(now, 12 + 120),
      proposedAt: rosaProposedAt,
      decisionWindowEndsAt: addDays(rosaProposedAt, 14),
    },
  });
  await prisma.placementMatchEvent.create({
    data: {
      placementMatchId: "demo_match_rosad",
      fromStatus: "DRAFT",
      toStatus: "PROPOSED",
      actorUserId: opsUserId,
    },
  });

  // A placement package sitting in SHELTER_REVIEW for Priya.
  const { personId: leviPersonId } = await ensureDemoPerson(
    "levib",
    "Levi",
    "Brandt",
    "1993-06-30T00:00:00Z",
  );
  await prisma.application.upsert({
    where: { id: "demo_app_levib" },
    update: { status: ApplicationStatus.ACCEPTED },
    create: {
      id: "demo_app_levib",
      personId: leviPersonId,
      applicationNumber: "APP-2026-0295",
      status: ApplicationStatus.ACCEPTED,
      submittedAt: addDays(now, -45),
      decidedAt: addDays(now, -33),
    },
  });
  await prisma.participant.upsert({
    where: { personId: leviPersonId },
    update: {},
    create: { id: "demo_participant_levib", personId: leviPersonId },
  });
  await prisma.programEnrollment.upsert({
    where: { applicationId: "demo_app_levib" },
    update: { status: "READY_FOR_MATCHING" },
    create: {
      id: "demo_enrollment_levib",
      participantId: "demo_participant_levib",
      programId: program.id,
      applicationId: "demo_app_levib",
      status: "READY_FOR_MATCHING",
    },
  });
  await prisma.onboardingTask.deleteMany({
    where: { placement: { participantId: "demo_participant_levib" } },
  });
  await prisma.placementEvent.deleteMany({
    where: { placement: { participantId: "demo_participant_levib" } },
  });
  await prisma.placement.deleteMany({
    where: { participantId: "demo_participant_levib" },
  });
  await prisma.placementMatchEvent.deleteMany({
    where: { placementMatch: { participantId: "demo_participant_levib" } },
  });
  await prisma.placementMatch.deleteMany({
    where: { participantId: "demo_participant_levib" },
  });
  await prisma.placementMatch.create({
    data: {
      id: "demo_match_levib",
      participantId: "demo_participant_levib",
      programEnrollmentId: "demo_enrollment_levib",
      hostOrganizationId: "demo_org_shelter",
      organizationSiteId: "demo_site_frontrange",
      status: "APPROVED",
      participantDecision: "ACCEPTED",
      shelterDecision: "APPROVED",
      proposedSupervisorId: shelterUserId,
      proposedSchedule: "Mon/Wed afternoons",
      approvedAt: addDays(now, -6),
      approvedByUserId: opsUserId,
    },
  });
  await prisma.placement.create({
    data: {
      id: "demo_placement_levib",
      placementNumber: "PLC-2026-0115",
      participantId: "demo_participant_levib",
      programEnrollmentId: "demo_enrollment_levib",
      hostOrganizationId: "demo_org_shelter",
      organizationSiteId: "demo_site_frontrange",
      sourceMatchId: "demo_match_levib",
      status: "SHELTER_REVIEW",
      supervisorId: shelterUserId,
      schedule: "Mon/Wed afternoons",
      startDate: addDays(now, 10),
    },
  });
  await prisma.placementEvent.create({
    data: {
      placementId: "demo_placement_levib",
      fromStatus: "PROPOSED",
      toStatus: "SHELTER_REVIEW",
      actorUserId: opsUserId,
      createdAt: addDays(now, -3),
    },
  });

  // ------------------------------------------------- Incident + funding
  await prisma.incident.create({
    data: {
      id: "demo_incident_slip",
      incidentNumber: "INC-2026-000217",
      placementId: "demo_placement_devonteh",
      category: "SAFETY",
      severity: "SERIOUS",
      occurredOn: addDays(now, -2),
      reporterUserId: shelterUserId,
      description:
        "Slip on a freshly mopped kennel corridor. No injury; area was cordoned and signage added. Reviewing footwear guidance with the site team.",
      status: "OPEN",
    },
  });

  await prisma.fundingSource.upsert({
    where: { id: "demo_funding_crw" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "demo_funding_crw",
      name: "Colorado Reentry Works Grant",
      kind: FundingSourceKind.GRANT,
      code: "CRW-2026",
      status: ActiveStatus.ACTIVE,
    },
  });
  await prisma.fundingSource.upsert({
    where: { id: "demo_funding_scef" },
    update: { status: ActiveStatus.ACTIVE },
    create: {
      id: "demo_funding_scef",
      name: "Second Chance Employment Fund",
      kind: FundingSourceKind.CONTRACT,
      code: "SCEF-24",
      status: ActiveStatus.ACTIVE,
    },
  });
  for (const [placementId, fundingSourceId, startDaysAgo] of [
    ["demo_placement_katie", "demo_funding_crw", 34],
    ["demo_placement_devonteh", "demo_funding_crw", 48],
    ["demo_placement_alician", "demo_funding_scef", 55],
    ["demo_placement_gracew", "demo_funding_scef", 150],
  ] as const) {
    await prisma.fundingAssignment.create({
      data: {
        placementId,
        fundingSourceId,
        startDate: addDays(now, -startDaysAgo),
        assignedByUserId: grantsUserId,
      },
    });
  }

  // ------------------------------------------------------------- Audit
  await prisma.auditEvent.deleteMany({ where: { subjectId: { startsWith: "demo_" } } });
  const AUDIT_ROWS = [
    {
      actorUserId: opsUserId,
      action: "application.accept",
      subjectType: "Application",
      subjectId: "demo_app_katie",
      detail: "Accepted into Transitional Employment Program",
      daysAgo: 55,
    },
    {
      actorUserId: opsUserId,
      action: "placement.activate",
      subjectType: "Placement",
      subjectId: "demo_placement_katie",
      detail: "Activated at Front Range Rescue — Main Campus",
      daysAgo: 34,
    },
    {
      actorUserId: grantsUserId,
      action: "funding.assign",
      subjectType: "Placement",
      subjectId: "demo_placement_katie",
      detail: "Colorado Reentry Works Grant assigned",
      daysAgo: 34,
    },
    {
      actorUserId: opsUserId,
      action: "timesheet.lock",
      subjectType: "Timesheet",
      subjectId: "demo_ts_katie_1",
      detail: "final for reporting: 13.00 hours",
      daysAgo: 21,
    },
    {
      actorUserId: opsUserId,
      action: "timesheet.lock",
      subjectType: "Timesheet",
      subjectId: "demo_ts_katie_2",
      detail: "final for reporting: 13.00 hours",
      daysAgo: 14,
    },
  ];
  for (const row of AUDIT_ROWS) {
    const { daysAgo, ...data } = row;
    await prisma.auditEvent.create({ data: { ...data, createdAt: addDays(now, -daysAgo) } });
  }

  console.log(
    `Demo world ready: ${DEMO_ACCOUNTS.length} sign-in accounts (password set), ` +
      "3 demo organizations, 13 demo people across the pipeline, " +
      "4 placements + Katie's active journey, timesheets, funding, incident, audit.",
  );
  console.log("Sign-ins: " + DEMO_ACCOUNTS.map((a) => a.email).join(", "));
} finally {
  await prisma.$disconnect();
}
