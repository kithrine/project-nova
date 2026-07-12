import { redirect } from "next/navigation";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { getOrProvisionAuthContext } from "@/server/auth/context";
import { routeForContext } from "@/server/auth/experience";

export const metadata = { title: "Dashboard" };

/**
 * Role router (Story 1.7, supersedes the 1.2 placeholder). Signed-in users
 * are sent to their experience: operations staff -> /operations, shelter
 * staff -> /shelter, everyone else -> /participant. Unprovisioned accounts
 * see a clear setup-pending state instead of an error.
 */
export default async function DashboardPage() {
  const ctx = await getOrProvisionAuthContext();

  if (!ctx) {
    return (
      <main id="main-content" className="flex flex-1 flex-col">
        <PermissionDenied
          title="Your account isn't set up yet"
          description="Your sign-in worked, but your Project Nova account setup isn't finished. Please contact your coordinator."
        />
      </main>
    );
  }

  redirect(routeForContext(ctx));
}
