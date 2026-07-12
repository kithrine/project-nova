import {
  ActiveStatus,
  EnrollmentStatus,
  OnboardingTaskStatus,
} from "@/generated/prisma/client";
import type { OnboardingTaskTemplate, Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import { AuthorizationError, LifecycleError, NotFoundError } from "@/server/errors/app-error";

/**
 * Enrollment service (Story 3.1). Participant + ProgramEnrollment are
 * created ONLY inside the acceptance transaction (2.11's acceptApplication)
 * via createEnrollmentForAcceptedApplication — there is deliberately no
 * standalone route, action, or permission that creates them (AC5). Reads
 * for the Operations enrollment view live here too.
 */

/** The MVP's single program, resolved by stable code at acceptance time. */
export const DEFAULT_PROGRAM_CODE = "NOVA-TE";

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  [EnrollmentStatus.ONBOARDING]: "Onboarding",
  [EnrollmentStatus.READY_FOR_MATCHING]: "Ready for matching",
};

/**
 * The Story 3.1 transaction body, composed into 2.11's acceptance
 * transaction: reuse-or-create the Participant for the Person (one
 * Participant identity per Person, ever — AC3), create the
 * ProgramEnrollment against the default active Program, and write the
 * enrollment's creation lifecycle event plus the enrollment.create audit
 * event. Any throw rolls back the WHOLE acceptance (AC2).
 */
export async function createEnrollmentForAcceptedApplication(
  tx: Prisma.TransactionClient,
  application: { id: string; personId: string },
  actorUserId: string,
): Promise<{ enrollmentId: string; participantId: string }> {
  const program = await tx.program.findUnique({
    where: { code: DEFAULT_PROGRAM_CODE },
  });
  if (!program || program.status !== ActiveStatus.ACTIVE) {
    // Rolls back the acceptance — never a half-created accepted applicant.
    throw new LifecycleError(
      "No active program is configured for enrollment. Contact a Nova administrator before accepting applications.",
    );
  }

  const participant =
    (await tx.participant.findUnique({ where: { personId: application.personId } })) ??
    (await tx.participant.create({ data: { personId: application.personId } }));

  const enrollment = await tx.programEnrollment.create({
    data: {
      participantId: participant.id,
      programId: program.id,
      applicationId: application.id,
    },
  });

  await tx.enrollmentEvent.create({
    data: {
      enrollmentId: enrollment.id,
      fromStatus: null,
      toStatus: EnrollmentStatus.ONBOARDING,
      actorUserId,
    },
  });
  await tx.auditEvent.create({
    data: {
      actorUserId,
      action: "enrollment.create",
      subjectType: "ProgramEnrollment",
      subjectId: enrollment.id,
    },
  });

  // Story 3.2: the onboarding checklist generates in this SAME transaction —
  // enrollment and its task list exist together or not at all.
  await generateOnboardingTasksForEnrollment(tx, {
    id: enrollment.id,
    programId: program.id,
  });

  return { enrollmentId: enrollment.id, participantId: participant.id };
}

// --- Onboarding task generation (Story 3.2) ------------------------------------

/** Pure: how one catalog template becomes one enrollment-owned task row. */
export function taskDataFromTemplate(
  template: Pick<
    OnboardingTaskTemplate,
    "id" | "title" | "description" | "required" | "participantCompletable" | "sortOrder"
  >,
  enrollmentId: string,
) {
  return {
    enrollmentId,
    templateId: template.id,
    title: template.title,
    description: template.description,
    required: template.required,
    participantCompletable: template.participantCompletable,
    sortOrder: template.sortOrder,
    status: OnboardingTaskStatus.NOT_STARTED,
  };
}

/**
 * Generate one task per catalog template for the enrollment's program
 * (AC1/AC2), all-or-nothing inside the caller's transaction. Idempotent per
 * enrollment (AC3): a retry that finds existing tasks generates nothing,
 * and the (enrollmentId, templateId) unique constraint backstops races.
 */
export async function generateOnboardingTasksForEnrollment(
  tx: Prisma.TransactionClient,
  enrollment: { id: string; programId: string },
): Promise<number> {
  const existing = await tx.onboardingTask.count({
    where: { enrollmentId: enrollment.id },
  });
  if (existing > 0) {
    return 0;
  }
  const templates = await tx.onboardingTaskTemplate.findMany({
    where: { programId: enrollment.programId },
    orderBy: { sortOrder: "asc" },
  });
  if (templates.length === 0) {
    return 0;
  }
  await tx.onboardingTask.createMany({
    data: templates.map((template) => taskDataFromTemplate(template, enrollment.id)),
  });
  return templates.length;
}

// --- Onboarding task reads (Story 3.2) ------------------------------------------

export const ONBOARDING_TASK_STATUS_LABELS: Record<OnboardingTaskStatus, string> = {
  [OnboardingTaskStatus.NOT_STARTED]: "Not started",
  [OnboardingTaskStatus.COMPLETE]: "Complete",
};

export interface OnboardingTaskView {
  id: string;
  title: string;
  description: string;
  required: boolean;
  participantCompletable: boolean;
  status: OnboardingTaskStatus;
  statusLabel: string;
}

export async function listOnboardingTasks(
  ctx: AuthContext,
  enrollmentId: string,
): Promise<OnboardingTaskView[]> {
  if (!hasPermission(ctx, "onboardingTask.view")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (!enrollment) {
    throw new NotFoundError();
  }
  const tasks = await prisma.onboardingTask.findMany({
    where: { enrollmentId },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    required: task.required,
    participantCompletable: task.participantCompletable,
    status: task.status,
    statusLabel: ONBOARDING_TASK_STATUS_LABELS[task.status],
  }));
}

// --- Operations reads ----------------------------------------------------------

export interface EnrollmentView {
  id: string;
  participantName: string;
  programName: string;
  status: EnrollmentStatus;
  statusLabel: string;
  enrolledAtLabel: string;
  applicationId: string;
  applicationNumber: string;
}

function requireEnrollmentAccess(ctx: AuthContext): void {
  // The enrollment surface is Nova Operations territory; the application
  // permission that admitted the viewer to the acceptance flow admits them
  // here (3.2 adds onboardingTask.view for the task list specifically).
  if (!hasPermission(ctx, "application.view")) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
}

function toEnrollmentView(enrollment: {
  id: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  applicationId: string;
  program: { name: string };
  application: { applicationNumber: string };
  participant: { person: { legalFirstName: string; legalLastName: string } };
}): EnrollmentView {
  return {
    id: enrollment.id,
    participantName: `${enrollment.participant.person.legalFirstName} ${enrollment.participant.person.legalLastName}`,
    programName: enrollment.program.name,
    status: enrollment.status,
    statusLabel: ENROLLMENT_STATUS_LABELS[enrollment.status],
    enrolledAtLabel: enrollment.enrolledAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    applicationId: enrollment.applicationId,
    applicationNumber: enrollment.application.applicationNumber,
  };
}

const ENROLLMENT_INCLUDE = {
  program: { select: { name: true } },
  application: { select: { applicationNumber: true } },
  participant: {
    select: { person: { select: { legalFirstName: true, legalLastName: true } } },
  },
} as const;

export async function getEnrollment(
  ctx: AuthContext,
  enrollmentId: string,
): Promise<EnrollmentView> {
  requireEnrollmentAccess(ctx);
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: enrollmentId },
    include: ENROLLMENT_INCLUDE,
  });
  if (!enrollment) {
    throw new NotFoundError();
  }
  return toEnrollmentView(enrollment);
}

/** The enrollment created by an application's acceptance, if any. */
export async function getEnrollmentForApplication(
  ctx: AuthContext,
  applicationId: string,
): Promise<EnrollmentView | null> {
  requireEnrollmentAccess(ctx);
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { applicationId },
    include: ENROLLMENT_INCLUDE,
  });
  return enrollment ? toEnrollmentView(enrollment) : null;
}
