import { AppShell } from "@/components/layout/app-shell";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getAuthContext } from "@/server/auth/context";
import { canAccessExperience } from "@/server/auth/experience";

/**
 * Shelter partner experience shell (Story 1.7). Requires an ACTIVE shelter
 * membership (Shelter Supervisor or Shelter Manager) — enforced server-side
 * from Nova data, never from client claims.
 */
export default async function ShelterLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();

  if (!ctx || !canAccessExperience(ctx, "shelter")) {
    return <PermissionDenied />;
  }

  return (
    <AppShell experience="shelter" userLabel={ctx.displayName}>
      {children}
    </AppShell>
  );
}
