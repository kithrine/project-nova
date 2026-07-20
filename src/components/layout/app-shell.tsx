import { UserButton } from "@clerk/nextjs";
import Image from "next/image";

import { BreathingDots } from "@/components/decor/breathing-dots";
import { AppShellNav } from "@/components/layout/app-shell-nav";
import { NavIcon } from "@/components/layout/nav-icons";
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
 * nav links override to the accent ring in AppShellNav). A breathing dot
 * field sits fixed in the viewport's bottom-right corner behind all
 * content (visual pass 2026-07-18) — every signed-in page gets it via
 * this one mount.
 */

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
      {/* Ambient corner decoration: fixed to the viewport, painted in the
          negative z band — above the cream canvas, below every element
          background, so dots show only through transparent areas. */}
      <BreathingDots
        anchor="bottom-right"
        className="fixed right-0 bottom-0 -z-10 h-[min(26rem,55vh)] w-[min(44rem,70vw)]"
      />
      {/* Desktop: the full-height deep-teal sidebar. Relative + clipped so
          the leaf art can anchor to its bottom-left corner. */}
      <aside className="relative hidden shrink-0 flex-col overflow-hidden bg-primary text-base-100 md:flex md:w-64">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-2">
          {/* Official brand mark (styling round 2) — transparent PNG, its
              chartreuse points pop on the teal rail; decorative (the brand
              name is the adjacent text). */}
          <Image
            src="/images/logo-official.png"
            alt=""
            width={1069}
            height={1074}
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span className="text-sm font-semibold tracking-[0.14em] uppercase">
            Project Nova
          </span>
        </div>
        <nav aria-label={navLabel} className="px-3 py-4">
          <AppShellNav items={items} tone="sidebar" />
        </nav>
        <div className="mx-5 border-t border-base-100/15" />
        <div className="flex-1" />
        {/* Photographic leaf line-art (round 4, replacing the hand-drawn
            sprig): anchored to the sidebar's bottom-left, BEHIND the quote
            card — the card is positioned (relative) and later in the DOM,
            so it paints above the absolutely-positioned image. */}
        <Image
          src="/images/white-leaves-navbar.png"
          alt=""
          width={1536}
          height={1024}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 w-full opacity-25"
        />
        {/* Non-interactive by rule: the primary focus ring vanishes on teal.
            Full-opacity cream text: the card tint lightens the backdrop, so
            muted /85 text would dip below AA on the composite (axe-verified). */}
        <div className="relative m-3 rounded-lg bg-base-100/10 p-4">
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
                <Image
                  src="/images/logo-official.png"
                  alt=""
                  width={1069}
                  height={1074}
                  className="h-7 w-7 object-contain"
                />
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
