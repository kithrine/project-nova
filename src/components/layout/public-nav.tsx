"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Public header navigation (mobile nav pass, 2026-07-20). Below md the
 * links collapse behind a hamburger disclosure button; from md up they
 * render as the original inline row. The links exist exactly ONCE in the
 * DOM — the closed panel is class-hidden, never conditionally rendered,
 * never aria-hidden — because the page suites assert singular landmarks
 * and a singular "Apply Now" link (jsdom sees through CSS). Deliberately
 * a disclosure, not a modal: no focus trap; Escape closes and returns
 * focus to the button. Client component for the open state only — the
 * header shell stays a server component (app-shell-nav precedent).
 */

const PILL_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
] as const;

const PANEL_ID = "public-nav-panel";

/* Stacked 44px-tall rows on mobile; the original pills from md up. */
const navLinkClasses =
  "rounded-lg px-3 py-3 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:rounded-full md:py-1.5";

/* [transform-box:fill-box] makes origin-center each LINE's own center
   (the SVG default, view-box, would rotate all three about the icon
   center and skew the X badly off-axis). */
const iconLineClasses =
  "origin-center [transform-box:fill-box] transition-[translate,rotate,opacity] duration-(--duration-fast)";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const close = () => setOpen(false);

  // The (public) layout — and this state — survive client-side
  // navigations, so close on any route change this menu didn't
  // initiate itself (brand link, browser back/forward).
  // Adjust-during-render, not an effect: react-hooks/set-state-in-effect.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  // Disclosure, not a modal: when keyboard focus leaves the component
  // the sheet must not linger over the content the user is focusing
  // (WCAG 2.4.11) — close instead of trapping focus.
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  return (
    <div className="contents" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-full text-base-content hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
      >
        {/* Hamburger→X morph: each outer line rotates about its own
            center (fill-box) while sliding to the vertical middle, so
            the diagonals cross at the icon midpoint. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-6"
        >
          <line
            x1="4"
            y1="6"
            x2="20"
            y2="6"
            className={`${iconLineClasses} ${open ? "translate-y-[6px] rotate-45" : ""}`}
          />
          <line
            x1="4"
            y1="12"
            x2="20"
            y2="12"
            className={`${iconLineClasses} ${open ? "opacity-0" : ""}`}
          />
          <line
            x1="4"
            y1="18"
            x2="20"
            y2="18"
            className={`${iconLineClasses} ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
          />
        </svg>
      </button>

      {/* Overlay sheet below the header on mobile (the header supplies
          position:relative + z-40); the plain inline row from md up.
          Opaque bg so panel text always composites on cream. */}
      <div
        id={PANEL_ID}
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-1 border-b border-base-300/70 bg-base-100 px-4 py-3 text-sm font-medium shadow-lg md:static md:flex md:w-auto md:flex-row md:items-center md:gap-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <div className="contents md:flex md:items-center md:gap-1 md:rounded-full md:border md:border-base-300 md:bg-base-100/70 md:p-1">
          {PILL_LINKS.map((item) => (
            <Link key={item.href} href={item.href} onClick={close} className={navLinkClasses}>
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/sign-in" onClick={close} className={navLinkClasses}>
          Log In
        </Link>
        <Link
          href="/sign-up"
          onClick={close}
          className="mt-1 rounded-full bg-accent px-4 py-3 text-center font-semibold text-accent-content transition-[color,background-color,box-shadow,transform] hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:shadow-none md:mt-0 md:py-1.5"
        >
          Apply Now
        </Link>
      </div>
    </div>
  );
}
