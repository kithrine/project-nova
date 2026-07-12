import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { TaskList } from "@/features/enrollment/task-list";
import { hasNovaScope, hasPermission } from "@/server/auth/authorize";
import { getAuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors/app-error";
import { getEnrollment, listOnboardingTasks } from "@/server/services/enrollment-service";

export const metadata = { title: "Enrollment" };

/**
 * Enrollment workspace (Stories 3.1+; docs/ux/wireframes-layouts.md).
 * Created automatically by the acceptance transaction — there is no
 * "create enrollment" action anywhere. Grows section by section through
 * Epic 3: onboarding tasks (3.2/3.3), training (3.4), certifications
 * (3.5), matching readiness (3.6/3.7).
 */
export default async function EnrollmentPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx || !hasPermission(ctx, "application.view") || !hasNovaScope(ctx)) {
    return <PermissionDenied />;
  }

  const { enrollmentId } = await params;
  let enrollment;
  try {
    enrollment = await getEnrollment(ctx, enrollmentId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-base-content/60">Enrollment</p>
        <h1 className="text-2xl font-bold tracking-tight">{enrollment.participantName}</h1>
        <p className="text-sm text-base-content/70">
          {enrollment.programName} · <span className="font-medium">{enrollment.statusLabel}</span>{" "}
          · Enrolled {enrollment.enrolledAtLabel} ·{" "}
          <Link
            href={`/operations/applications/${enrollment.applicationId}`}
            className="underline underline-offset-2"
          >
            {enrollment.applicationNumber}
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 pt-6">
        <h2 className="text-lg font-semibold">Onboarding tasks</h2>
        <p className="max-w-prose text-sm text-base-content/70">
          Generated automatically from the program&apos;s required-task catalog the
          moment the enrollment was created. Completion arrives with Story 3.3.
        </p>
        {hasPermission(ctx, "onboardingTask.view") ? (
          <TaskList tasks={await listOnboardingTasks(ctx, enrollment.id)} />
        ) : (
          <p className="max-w-prose text-sm text-base-content/70">
            You don&apos;t have access to the onboarding task list.
          </p>
        )}
      </div>
    </section>
  );
}
