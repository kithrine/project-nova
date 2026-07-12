import {
  ActiveStatus,
  OnboardingTaskStatus,
  TrainingCompletionMethod,
  TrainingEnrollmentStatus,
} from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { hasPermission, requireNovaScope } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import {
  assertTrainingTransition,
  getOutstandingRequiredTraining,
  trainingTransitionFields,
} from "@/server/domain/training-enrollment";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";

export const TRAINING_STATUS_LABELS: Record<TrainingEnrollmentStatus, string> = {
  [TrainingEnrollmentStatus.ENROLLED]: "Enrolled",
  [TrainingEnrollmentStatus.IN_PROGRESS]: "In progress",
  [TrainingEnrollmentStatus.COMPLETED]: "Completed",
  [TrainingEnrollmentStatus.WITHDRAWN]: "Withdrawn",
};

export const TRAINING_COMPLETION_METHOD_LABELS: Record<TrainingCompletionMethod, string> = {
  [TrainingCompletionMethod.KNOWLEDGE_ASSESSMENT]: "Knowledge assessment passed",
  [TrainingCompletionMethod.PROVIDER_VERIFICATION]: "Provider completion verified",
  [TrainingCompletionMethod.OBSERVED_COMPETENCY]: "Competency observed",
  [TrainingCompletionMethod.PRIOR_LEARNING_VERIFICATION]: "Prior learning verified",
};

function requireCreateAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "trainingEnrollment.create")) throw new AuthorizationError();
  requireNovaScope(ctx);
}

function requireUpdateAccess(ctx: AuthContext): void {
  if (!hasPermission(ctx, "trainingEnrollment.update")) throw new AuthorizationError();
  requireNovaScope(ctx);
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

export interface CreateTrainingEnrollmentInput {
  programEnrollmentId: string;
  trainingProgramId: string;
  enrolledAt: Date;
  expectedCompletionDate?: Date | null;
  providerName?: string | null;
}

export async function createTrainingEnrollment(
  ctx: AuthContext,
  input: CreateTrainingEnrollmentInput,
): Promise<{ id: string }> {
  requireCreateAccess(ctx);
  if (
    input.expectedCompletionDate &&
    input.expectedCompletionDate.getTime() < input.enrolledAt.getTime()
  ) {
    throw new ValidationError("Expected completion cannot be before enrollment.");
  }

  const [enrollment, trainingProgram] = await Promise.all([
    prisma.programEnrollment.findUnique({
      where: { id: input.programEnrollmentId },
      select: { id: true, programId: true },
    }),
    prisma.trainingProgram.findUnique({
      where: { id: input.trainingProgramId },
      select: { id: true, programId: true, status: true },
    }),
  ]);
  if (!enrollment || !trainingProgram) throw new NotFoundError();
  if (
    trainingProgram.programId !== enrollment.programId ||
    trainingProgram.status !== ActiveStatus.ACTIVE
  ) {
    throw new ValidationError(
      "Choose an active training program configured for this enrollment.",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.trainingEnrollment.create({
        data: {
          programEnrollmentId: enrollment.id,
          trainingProgramId: trainingProgram.id,
          enrolledAt: input.enrolledAt,
          expectedCompletionDate: input.expectedCompletionDate ?? null,
          providerName: input.providerName?.trim() || null,
        },
        select: { id: true },
      });
      await tx.trainingEnrollmentEvent.create({
        data: {
          trainingEnrollmentId: created.id,
          fromStatus: null,
          toStatus: TrainingEnrollmentStatus.ENROLLED,
          actorUserId: ctx.userId,
          effectiveDate: input.enrolledAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: ctx.userId,
          action: "trainingEnrollment.create",
          subjectType: "TrainingEnrollment",
          subjectId: created.id,
        },
      });
      return created;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new ConflictError("An active attempt already exists for this training program.");
    }
    throw error;
  }
}

export interface TransitionTrainingEnrollmentInput {
  trainingEnrollmentId: string;
  toStatus: TrainingEnrollmentStatus;
  effectiveDate: Date;
  completionMethod?: TrainingCompletionMethod | null;
}

export async function transitionTrainingEnrollment(
  ctx: AuthContext,
  input: TransitionTrainingEnrollmentInput,
): Promise<void> {
  requireUpdateAccess(ctx);
  const attempt = await prisma.trainingEnrollment.findUnique({
    where: { id: input.trainingEnrollmentId },
    select: { id: true, status: true, enrolledAt: true, startedAt: true },
  });
  if (!attempt) throw new NotFoundError();
  assertTrainingTransition(attempt.status, input.toStatus);

  const minimumDate = attempt.startedAt ?? attempt.enrolledAt;
  if (input.effectiveDate.getTime() < minimumDate.getTime()) {
    throw new ValidationError(
      "The effective date cannot be before this training attempt began.",
    );
  }
  const fields = trainingTransitionFields({
    toStatus: input.toStatus,
    effectiveDate: input.effectiveDate,
    completionMethod: input.completionMethod ?? null,
    actorUserId: ctx.userId,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.trainingEnrollment.updateMany({
        where: { id: attempt.id, status: attempt.status },
        data: { status: input.toStatus, ...fields },
      });
      if (updated.count === 0) {
        throw new ConflictError("This training attempt changed. Refresh and try again.");
      }
      await tx.trainingEnrollmentEvent.create({
        data: {
          trainingEnrollmentId: attempt.id,
          fromStatus: attempt.status,
          toStatus: input.toStatus,
          actorUserId: ctx.userId,
          effectiveDate: input.effectiveDate,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: ctx.userId,
          action: "trainingEnrollment.update",
          subjectType: "TrainingEnrollment",
          subjectId: attempt.id,
          detail: `${attempt.status}->${input.toStatus}`,
        },
      });
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new ConflictError("An active attempt already exists for this training program.");
    }
    throw error;
  }
}

function formatDate(date: Date | null): string | null {
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
}

export interface TrainingAttemptView {
  id: string;
  status: TrainingEnrollmentStatus;
  statusLabel: string;
  enrolledAtLabel: string;
  expectedCompletionDateLabel: string | null;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  withdrawnAtLabel: string | null;
  providerName: string | null;
  completionMethodLabel: string | null;
}

export interface TrainingProgramView {
  id: string;
  code: string;
  name: string;
  description: string;
  requiredForMatching: boolean;
  attempts: TrainingAttemptView[];
}

export async function listTrainingForEnrollment(
  ctx: AuthContext,
  programEnrollmentId: string,
): Promise<TrainingProgramView[]> {
  if (
    !hasPermission(ctx, "trainingEnrollment.create") &&
    !hasPermission(ctx, "trainingEnrollment.update")
  ) {
    throw new AuthorizationError();
  }
  requireNovaScope(ctx);
  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: programEnrollmentId },
    select: { programId: true },
  });
  if (!enrollment) throw new NotFoundError();
  const programs = await prisma.trainingProgram.findMany({
    where: { programId: enrollment.programId, status: ActiveStatus.ACTIVE },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      enrollments: {
        where: { programEnrollmentId },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return programs.map((program) => ({
    id: program.id,
    code: program.code,
    name: program.name,
    description: program.description,
    requiredForMatching: program.requiredForMatching,
    attempts: program.enrollments.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      statusLabel: TRAINING_STATUS_LABELS[attempt.status],
      enrolledAtLabel: formatDate(attempt.enrolledAt)!,
      expectedCompletionDateLabel: formatDate(attempt.expectedCompletionDate),
      startedAtLabel: formatDate(attempt.startedAt),
      completedAtLabel: formatDate(attempt.completedAt),
      withdrawnAtLabel: formatDate(attempt.withdrawnAt),
      providerName: attempt.providerName,
      completionMethodLabel: attempt.completionMethod
        ? TRAINING_COMPLETION_METHOD_LABELS[attempt.completionMethod]
        : null,
    })),
  }));
}

export interface ParticipantTrainingJourney {
  stage: "ONBOARDING" | "TRAINING" | "TRAINING_COMPLETE";
  programName: string;
  requiredCount: number;
  completedCount: number;
}

export async function getOwnTrainingJourney(
  ctx: AuthContext,
): Promise<ParticipantTrainingJourney | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    select: { participant: { select: { id: true } } },
  });
  if (!person?.participant) return null;
  const enrollment = await prisma.programEnrollment.findFirst({
    where: { participantId: person.participant.id },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      program: {
        select: {
          name: true,
          trainingPrograms: {
            where: { status: ActiveStatus.ACTIVE, requiredForMatching: true },
            select: { id: true, name: true, requiredForMatching: true },
          },
        },
      },
      onboardingTasks: {
        where: { required: true, status: OnboardingTaskStatus.NOT_STARTED },
        select: { id: true },
      },
      trainingEnrollments: {
        select: { trainingProgramId: true, status: true },
      },
    },
  });
  if (!enrollment) return null;
  const outstanding = getOutstandingRequiredTraining(
    enrollment.program.trainingPrograms,
    enrollment.trainingEnrollments,
  );
  const requiredCount = enrollment.program.trainingPrograms.length;
  return {
    stage:
      enrollment.onboardingTasks.length > 0
        ? "ONBOARDING"
        : outstanding.length > 0
          ? "TRAINING"
          : "TRAINING_COMPLETE",
    programName: enrollment.program.name,
    requiredCount,
    completedCount: requiredCount - outstanding.length,
  };
}
