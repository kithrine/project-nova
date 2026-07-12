import { AppShell } from "@/components/layout/app-shell";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { canAccessExperience } from "@/server/auth/experience";

/**
 * Participant experience shell (Stories 1.7/2.2). First entry provisions the
 * internal User for fresh Clerk sign-ups (the webhook cannot reach local or
 * preview environments); the linked-participant-identity gate tightens with
 * Epic 3. Middleware already requires authentication for this route group.
 */
export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrProvisionAuthContext();

  if (!ctx) {
    return (
      <PermissionDenied
        title="Your account isn't set up yet"
        description="Your sign-in worked, but your Project Nova account setup isn't finished. Please contact your coordinator."
      />
    );
  }

  if (!canAccessExperience(ctx, "participant")) {
    return <PermissionDenied />;
  }

  return (
    <AppShell experience="participant" userLabel={ctx.displayName}>
      {children}
    </AppShell>
  );
}
