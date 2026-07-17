import { UserButton } from "@clerk/nextjs";

import { AppShellNav } from "@/components/layout/app-shell-nav";
import { NavIcon } from "@/components/layout/nav-icons";
import { NovaLogo } from "@/components/layout/nova-logo";
import { EXPERIENCE_LABELS, NAV_BY_EXPERIENCE } from "@/components/layout/nav-model";
import { Badge } from "@/components/ui/badge";
import type { Experience } from "@/server/auth/experience";

/**
 * Protected app shell (Story 1.7; brand pass 2026-07-16). Mobile-first:
 * navigation collapses into a native <details> disclosure on small
 * screens (keyboard-accessible with zero JavaScript) and becomes the
 * full-height deep-teal sidebar from md up. Unavailable destinations
 * render as Disabled entries, not dead links. The sidebar carries no
 * interactive elements outside the nav (the same focus-ring rule as the
 * public closing bands: the global primary ring is invisible on teal, so
 * nav links override to the accent ring in AppShellNav).
 */

/** Decorative leaf sprig for the sidebar's quiet space (aria-hidden). */
function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
    >
      <path d="M24 62C24 40 24 22 24 4" />
      <path d="M24 18C17 16 11 10 10 3c7 1 13 7 14 15Z" fill="currentColor" stroke="none" />
      <path d="M24 34c7-2 13-8 14-15-7 1-13 7-14 15Z" fill="currentColor" stroke="none" />
      <path d="M24 48c-7-2-13-8-14-15 7 1 13 7 14 15Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Decorative dot cluster (aria-hidden). */
function DotCluster({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 60 36" fill="currentColor" className={className}>
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle key={`${row}-${col}`} cx={6 + col * 12} cy={6 + row * 12} r="2" />
        )),
      )}
    </svg>
  );
}

/** Hand-drawn heart for the sidebar quote card (aria-hidden). */
function DrawnHeart({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
    >
      <path d="M12 19.2C7 15 2.6 11.4 2.4 7.4 2.3 4.6 4.4 2.6 6.9 2.6c2 0 3.8 1.2 5.1 3.2 1.3-2 3.1-3.2 5.1-3.2 2.5 0 4.6 2 4.5 4.8-.2 4-4.6 7.6-9.6 11.8Z" />
    </svg>
  );
}

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

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Desktop: the full-height deep-teal sidebar */}
      <aside className="hidden shrink-0 flex-col bg-primary text-base-100 md:flex md:w-64">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-2">
          <NovaLogo className="size-8 shrink-0 text-base-100" />
          <span className="text-sm font-semibold tracking-[0.14em] uppercase">
            Project Nova
          </span>
        </div>
        <nav aria-label={navLabel} className="px-3 py-4">
          <AppShellNav items={items} tone="sidebar" />
        </nav>
        <div className="mx-5 border-t border-base-100/15" />
        <div className="relative flex-1 overflow-hidden">
          <LeafSprig className="absolute bottom-2 left-4 h-16 w-12 text-base-100/20" />
          <DotCluster className="absolute right-4 bottom-6 h-9 w-15 text-base-100/15" />
        </div>
        {/* Non-interactive by rule: the primary focus ring vanishes on teal.
            Full-opacity cream text: the card tint lightens the backdrop, so
            muted /85 text would dip below AA on the composite (axe-verified). */}
        <div className="m-3 rounded-lg bg-base-100/10 p-4">
          <DrawnHeart className="size-6 text-accent" />
          <p className="mt-2 text-sm leading-relaxed text-base-100">
            Paid transitional work, real support, and a path toward lasting employment.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-base-300 bg-base-100">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {/* The sidebar owns the brand from md up. */}
              <span className="flex items-center gap-2 md:hidden">
                <NovaLogo className="size-6 text-primary" />
                <span className="text-base font-semibold">Project Nova</span>
              </span>
              <Badge tone="accent">{EXPERIENCE_LABELS[experience]}</Badge>
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
              <AppShellNav items={items} tone="sheet" />
            </nav>
          </details>
        </header>

        {/* min-w-0 lets main shrink below its content's intrinsic width so
            wide, internally-scrollable children (e.g. the placement tab
            strip) never force horizontal page scroll on small screens. */}
        <main id="main-content" className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
