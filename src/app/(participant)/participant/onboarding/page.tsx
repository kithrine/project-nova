import { redirect } from "next/navigation";

import { completeOnboardingAction } from "@/features/onboarding/actions";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnPerson } from "@/server/services/applicant-onboarding";

export const metadata = { title: "Set up your account" };

/**
 * Applicant account onboarding (Story 2.2). Collects the minimum identity
 * and contact information; creating these records confers no Role and no
 * Membership. A returning applicant with a completed record is sent
 * straight to their dashboard.
 */
export default async function OnboardingPage() {
  const ctx = await getOrProvisionAuthContext();
  if (!ctx) {
    // The participant layout already renders the setup-pending state;
    // reaching here without a context means no usable session.
    redirect("/sign-in");
  }

  const person = await getOwnPerson(ctx);
  if (person) {
    redirect("/participant");
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Set up your account</h1>
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          A few basics before you start your application. This takes about two minutes,
          and your information stays private.
        </p>
      </div>
      <OnboardingForm action={completeOnboardingAction} />
    </section>
  );
}
