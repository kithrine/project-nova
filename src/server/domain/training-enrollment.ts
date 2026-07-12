import { TrainingCompletionMethod, TrainingEnrollmentStatus } from "@/generated/prisma/client";
import { LifecycleError, ValidationError } from "@/server/errors/app-error";

const ALLOWED_TRANSITIONS: Readonly<
  Record<TrainingEnrollmentStatus, readonly TrainingEnrollmentStatus[]>
> = {
  [TrainingEnrollmentStatus.ENROLLED]: [
    TrainingEnrollmentStatus.IN_PROGRESS,
    TrainingEnrollmentStatus.COMPLETED,
    TrainingEnrollmentStatus.WITHDRAWN,
  ],
  [TrainingEnrollmentStatus.IN_PROGRESS]: [
    TrainingEnrollmentStatus.COMPLETED,
    TrainingEnrollmentStatus.WITHDRAWN,
  ],
  [TrainingEnrollmentStatus.COMPLETED]: [],
  [TrainingEnrollmentStatus.WITHDRAWN]: [],
};

export function assertTrainingTransition(
  fromStatus: TrainingEnrollmentStatus,
  toStatus: TrainingEnrollmentStatus,
): void {
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new LifecycleError(
      `Training cannot move from ${fromStatus.toLowerCase().replaceAll("_", " ")} to ${toStatus.toLowerCase().replaceAll("_", " ")}.`,
    );
  }
}

export function trainingTransitionFields({
  toStatus,
  effectiveDate,
  completionMethod,
  actorUserId,
}: {
  toStatus: TrainingEnrollmentStatus;
  effectiveDate: Date;
  completionMethod: TrainingCompletionMethod | null;
  actorUserId: string;
}) {
  if (toStatus === TrainingEnrollmentStatus.COMPLETED && !completionMethod) {
    throw new ValidationError("Choose how completion evidence was verified.");
  }
  if (toStatus !== TrainingEnrollmentStatus.COMPLETED && completionMethod) {
    throw new ValidationError(
      "Completion evidence is only recorded when training is completed.",
    );
  }

  switch (toStatus) {
    case TrainingEnrollmentStatus.IN_PROGRESS:
      return {
        startedAt: effectiveDate,
      };
    case TrainingEnrollmentStatus.COMPLETED:
      return {
        completedAt: effectiveDate,
        completionMethod,
        completionVerifiedByUserId: actorUserId,
        completionVerifiedAt: new Date(),
      };
    case TrainingEnrollmentStatus.WITHDRAWN:
      return {
        withdrawnAt: effectiveDate,
      };
    case TrainingEnrollmentStatus.ENROLLED:
      throw new LifecycleError("An existing training attempt cannot return to enrolled.");
  }
}

export interface TrainingRequirement {
  id: string;
  name: string;
  requiredForMatching: boolean;
}

export interface TrainingAttemptStatus {
  trainingProgramId: string;
  status: TrainingEnrollmentStatus;
}

export function getOutstandingRequiredTraining(
  programs: readonly TrainingRequirement[],
  attempts: readonly TrainingAttemptStatus[],
): { trainingProgramId: string; name: string }[] {
  const completed = new Set(
    attempts
      .filter((attempt) => attempt.status === TrainingEnrollmentStatus.COMPLETED)
      .map((attempt) => attempt.trainingProgramId),
  );
  return programs
    .filter((program) => program.requiredForMatching && !completed.has(program.id))
    .map((program) => ({ trainingProgramId: program.id, name: program.name }));
}
