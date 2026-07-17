"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrainingCompletionMethod, TrainingEnrollmentStatus } from "@/generated/prisma/enums";
import type { TrainingProgramView } from "@/server/services/training-service";
import {
  enrollTrainingAction,
  transitionTrainingAction,
  type TrainingActionState,
} from "./actions";

const INITIAL_STATE: TrainingActionState = { status: "idle" };

function StatusIcon({ status }: { status: TrainingEnrollmentStatus }) {
  if (status === TrainingEnrollmentStatus.COMPLETED) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 shrink-0 text-success">
        <path
          fill="currentColor"
          d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.8 6.2-4.4 4.8a.75.75 0 0 1-1.1 0L6.1 10.3a.75.75 0 1 1 1.1-1l1.6 1.6 3.9-4.2a.75.75 0 1 1 1.1 1Z"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-5 shrink-0 text-base-content/50"
    >
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === TrainingEnrollmentStatus.IN_PROGRESS ? (
        <circle cx="10" cy="10" r="3" fill="currentColor" />
      ) : null}
      {status === TrainingEnrollmentStatus.WITHDRAWN ? (
        <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.5" />
      ) : null}
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-error">
      {message}
    </p>
  ) : null;
}

function TransitionForm({
  enrollmentId,
  attemptId,
  toStatus,
  today,
}: {
  enrollmentId: string;
  attemptId: string;
  toStatus: TrainingEnrollmentStatus;
  today: string;
}) {
  const action = transitionTrainingAction.bind(null, enrollmentId, attemptId, toStatus);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const label =
    toStatus === TrainingEnrollmentStatus.IN_PROGRESS
      ? "Start training"
      : toStatus === TrainingEnrollmentStatus.COMPLETED
        ? "Record completion"
        : "Withdraw attempt";
  const prefix = `${attemptId}-${toStatus}`;
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-base-300 p-3"
    >
      <h4 className="text-sm font-semibold">{label}</h4>
      <label htmlFor={`${prefix}-date`} className="text-sm font-medium">
        Effective date
      </label>
      <input
        id={`${prefix}-date`}
        name="effectiveDate"
        type="date"
        required
        defaultValue={today}
        aria-describedby={state.fieldErrors?.effectiveDate ? `${prefix}-date-error` : undefined}
        className="input input-bordered input-sm max-w-xs"
      />
      <FieldError id={`${prefix}-date-error`} message={state.fieldErrors?.effectiveDate} />
      {toStatus === TrainingEnrollmentStatus.COMPLETED ? (
        <>
          <label htmlFor={`${prefix}-method`} className="text-sm font-medium">
            Completion evidence
          </label>
          <select
            id={`${prefix}-method`}
            name="completionMethod"
            required
            defaultValue=""
            aria-describedby={
              state.fieldErrors?.completionMethod ? `${prefix}-method-error` : undefined
            }
            className="select select-bordered select-sm max-w-md"
          >
            <option value="" disabled>
              Choose evidence method
            </option>
            <option value={TrainingCompletionMethod.KNOWLEDGE_ASSESSMENT}>
              Knowledge assessment passed
            </option>
            <option value={TrainingCompletionMethod.PROVIDER_VERIFICATION}>
              Provider completion verified
            </option>
            <option value={TrainingCompletionMethod.OBSERVED_COMPETENCY}>
              Competency observed
            </option>
            <option value={TrainingCompletionMethod.PRIOR_LEARNING_VERIFICATION}>
              Prior learning verified
            </option>
          </select>
          <FieldError
            id={`${prefix}-method-error`}
            message={state.fieldErrors?.completionMethod}
          />
        </>
      ) : null}
      {state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        aria-disabled={pending}
        onClick={(event) => pending && event.preventDefault()}
        className="self-start"
      >
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}

function EnrollForm({
  enrollmentId,
  programs,
  today,
}: {
  enrollmentId: string;
  programs: TrainingProgramView[];
  today: string;
}) {
  const action = enrollTrainingAction.bind(null, enrollmentId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form
      action={formAction}
      className="flex max-w-2xl flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-4"
    >
      <h3 className="font-semibold">Enroll in training</h3>
      <label htmlFor="training-program" className="text-sm font-medium">
        Training program
      </label>
      <select
        id="training-program"
        name="trainingProgramId"
        required
        defaultValue=""
        className="select select-bordered"
      >
        <option value="" disabled>
          Choose a program
        </option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>
            {program.name}
          </option>
        ))}
      </select>
      <FieldError id="training-program-error" message={state.fieldErrors?.trainingProgramId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="training-enrolled-at" className="text-sm font-medium">
            Enrollment date
          </label>
          <input
            id="training-enrolled-at"
            name="enrolledAt"
            type="date"
            required
            defaultValue={today}
            className="input input-bordered"
          />
          <FieldError id="training-enrolled-at-error" message={state.fieldErrors?.enrolledAt} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="training-expected-at" className="text-sm font-medium">
            Expected completion (optional)
          </label>
          <input
            id="training-expected-at"
            name="expectedCompletionDate"
            type="date"
            className="input input-bordered"
          />
          <FieldError
            id="training-expected-at-error"
            message={state.fieldErrors?.expectedCompletionDate}
          />
        </div>
      </div>
      <label htmlFor="training-provider" className="text-sm font-medium">
        Provider (optional)
      </label>
      <input id="training-provider" name="providerName" className="input input-bordered" />
      <FieldError id="training-provider-error" message={state.fieldErrors?.providerName} />
      {state.formError ? (
        <p role="alert" className="text-sm text-error">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        aria-disabled={pending}
        onClick={(event) => pending && event.preventDefault()}
        className="self-start"
      >
        {pending ? "Enrolling…" : "Enroll participant"}
      </Button>
    </form>
  );
}

export function TrainingList({
  enrollmentId,
  programs,
  canCreate,
  canUpdate,
  today,
}: {
  enrollmentId: string;
  programs: TrainingProgramView[];
  canCreate: boolean;
  canUpdate: boolean;
  today: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {canCreate ? (
        <EnrollForm enrollmentId={enrollmentId} programs={programs} today={today} />
      ) : null}
      <ul className="flex flex-col gap-4">
        {programs.map((program) => (
          <li key={program.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{program.name}</h3>
              <p className="text-sm text-base-content/70">{program.description}</p>
              <p className="text-xs font-medium text-base-content/60">
                {program.requiredForMatching ? "Required for matching" : "Optional"}
              </p>
            </div>
            {program.attempts.length === 0 ? (
              <p className="mt-3 text-sm text-base-content/70">Not enrolled yet.</p>
            ) : (
              <ol className="mt-4 flex flex-col gap-3" aria-label={`${program.name} attempts`}>
                {program.attempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-col gap-3 rounded-md bg-base-200/50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon status={attempt.status} />
                      <div>
                        <p>
                          <Badge tone={attempt.statusTone}>{attempt.statusLabel}</Badge>
                        </p>
                        <p className="text-sm text-base-content/70">
                          Enrolled {attempt.enrolledAtLabel}
                          {attempt.providerName ? ` · ${attempt.providerName}` : ""}
                        </p>
                        {attempt.startedAtLabel ? (
                          <p className="text-sm text-base-content/70">
                            Started {attempt.startedAtLabel}
                          </p>
                        ) : null}
                        {attempt.completedAtLabel ? (
                          <p className="text-sm text-base-content/70">
                            Completed {attempt.completedAtLabel}
                            {attempt.completionMethodLabel
                              ? ` · ${attempt.completionMethodLabel}`
                              : ""}
                          </p>
                        ) : null}
                        {attempt.withdrawnAtLabel ? (
                          <p className="text-sm text-base-content/70">
                            Withdrawn {attempt.withdrawnAtLabel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canUpdate &&
                    (attempt.status === TrainingEnrollmentStatus.ENROLLED ||
                      attempt.status === TrainingEnrollmentStatus.IN_PROGRESS) ? (
                      <div className="grid gap-3 lg:grid-cols-3">
                        {attempt.status === TrainingEnrollmentStatus.ENROLLED ? (
                          <TransitionForm
                            enrollmentId={enrollmentId}
                            attemptId={attempt.id}
                            toStatus={TrainingEnrollmentStatus.IN_PROGRESS}
                            today={today}
                          />
                        ) : null}
                        <TransitionForm
                          enrollmentId={enrollmentId}
                          attemptId={attempt.id}
                          toStatus={TrainingEnrollmentStatus.COMPLETED}
                          today={today}
                        />
                        <TransitionForm
                          enrollmentId={enrollmentId}
                          attemptId={attempt.id}
                          toStatus={TrainingEnrollmentStatus.WITHDRAWN}
                          today={today}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
