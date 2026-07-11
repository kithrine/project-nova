import { AppShell } from "@/components/layout/app-shell";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getAuthContext } from "@/server/auth/context";
import { canAccessExperience } from "@/server/auth/experience";

/**
 * Participant experience shell (Story 1.7). Requires a provisioned account;
 * the linked-participant-identity gate tightens with Epic 2/3. Middleware
 * already requires authentication for this route group.
 */
export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();

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
