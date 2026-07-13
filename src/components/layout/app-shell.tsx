import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { NavIcon } from "@/components/layout/nav-icons";
import { EXPERIENCE_LABELS, NAV_BY_EXPERIENCE } from "@/components/layout/nav-model";
import type { Experience } from "@/server/auth/experience";

/**
 * Protected app shell (Story 1.7). Mobile-first: navigation collapses into
 * a native <details> disclosure on small screens (keyboard-accessible with
 * zero JavaScript) and becomes a persistent sidebar from md up
 * (docs/ux/wireframe-spec.md responsive rules). Unavailable destinations
 * render as Disabled entries, not dead links.
 */
export function AppShell({
  experience,
  userLabel,
  children,
}: {
  experience: Experience;
  userLabel: string;
  children: React.ReactNode;
}) {
  const items = NAV_BY_EXPERIENCE[experience];
  const navLabel = `${EXPERIENCE_LABELS[experience]} navigation`;

  const navList = (
    <ul className="flex flex-col gap-1">
      {items.map((item) =>
        item.available ? (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ) : (
          <li key={item.href}>
            <span
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-base-content/40"
            >
              <NavIcon name={item.icon} />
              {item.label}
              <span className="sr-only">(coming soon)</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-base-300 bg-base-100">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">Project Nova</span>
            <span className="rounded-md bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/70">
              {EXPERIENCE_LABELS[experience]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-base-content/70 sm:inline">{userLabel}</span>
            <UserButton />
          </div>
        </div>

        {/* Mobile: collapsible disclosure nav */}
        <details className="border-t border-base-300 md:hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <NavIcon name="home" className="size-4" />
            Menu
          </summary>
          <nav aria-label={navLabel} className="px-2 pb-3">
            {navList}
          </nav>
        </details>
      </header>

      <div className="flex flex-1">
        {/* Desktop: persistent sidebar */}
        <nav
          aria-label={navLabel}
          className="hidden w-56 shrink-0 border-r border-base-300 p-3 md:block"
        >
          {navList}
        </nav>

        {/* min-w-0 lets main shrink below its content's intrinsic width so
            wide, internally-scrollable children (e.g. the placement tab
            strip) never force horizontal page scroll on small screens. */}
        <main id="main-content" className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
