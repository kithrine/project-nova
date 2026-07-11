import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

export const metadata = { title: "Dashboard" };

/**
 * Authenticated placeholder (Story 1.2). Proves the session boundary works;
 * Story 1.7 replaces this with role-specific protected layouts, routed by
 * membership. Reaching this page requires authentication (middleware);
 * it grants no domain capability.
 */
export default async function DashboardPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "your account";

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="border-b border-base-300">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-semibold">Project Nova</span>
          <UserButton />
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">You&apos;re signed in</h1>
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          Signed in as <span data-testid="user-email">{email}</span>. Your workspace is being
          built — role-based areas arrive with the next stories.
        </p>
      </section>
    </main>
  );
}
