import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { TimesheetReviewCard } from "@/features/timesheets/timesheet-review-card";
import { getAuthContext } from "@/server/auth/context";
import { AuthorizationError, NotFoundError } from "@/server/errors/app-error";
import { getTimesheetReview } from "@/server/services/timesheet-service";

export const metadata = { title: "Review Timesheet" };

/** The shelter-side Timesheet Review Card route (Story 6.5). */
export default async function ShelterTimesheetReviewPage({
  params,
}: {
  params: Promise<{ timesheetId: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;
  const { timesheetId } = await params;

  let review;
  try {
    review = await getTimesheetReview(ctx, timesheetId);
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-base-content/60">
        <Link href="/shelter/timesheets" className="underline underline-offset-2">
          Timesheets
        </Link>{" "}
        / {review.weekLabel}
      </p>
      <TimesheetReviewCard review={review} />
    </div>
  );
}
