import { AppShell } from "@/components/layout/app-shell";
import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getAuthContext } from "@/server/auth/context";
import { canAccessExperience } from "@/server/auth/experience";

/**
 * Nova Operations experience shell (Story 1.7). Requires an ACTIVE
 * Nova-staff membership — enforced server-side from Nova data, never from
 * client claims. Individual operations inside still run the full
 * permission + scope + lifecycle checks (Story 1.5).
 */
export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();

  if (!ctx || !canAccessExperience(ctx, "operations")) {
    return <PermissionDenied />;
  }

  return (
    <AppShell experience="operations" userLabel={ctx.displayName}>
      {children}
    </AppShell>
  );
}
