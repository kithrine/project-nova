import { redirect } from "next/navigation";

import { OwnCertifications } from "@/features/certifications/own-certifications";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { getOwnCertifications } from "@/server/services/certification-service";

export const metadata = { title: "Certifications" };

/**
 * The participant's own certifications (Story 3.5) — read-only, plain
 * language, no coordinator-only detail (AC4). Ownership-scoped: the query
 * starts from the signed-in user's Person, so another participant's
 * records are structurally unreachable.
 */
export default async function CertificationsPage() {
  const ctx = await getOrProvisionAuthContext();
  if (!ctx) redirect("/sign-in");

  const certifications = await getOwnCertifications(ctx);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Certifications</h1>
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          Credentials Nova has on record for you. If something looks wrong or is
          missing, tell your coordinator — they can fix it.
        </p>
      </div>
      <OwnCertifications certifications={certifications} />
    </section>
  );
}
