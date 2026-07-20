import Image from "next/image";
import Link from "next/link";

import { PublicNav } from "@/components/layout/public-nav";

/**
 * Public site header (Story 2.1; brand refresh 2026-07-15; mobile nav
 * pass 2026-07-20). Minimal navigation for the public pages that exist
 * today — links are added as their pages are built (no dead links). The
 * chartreuse "Apply Now" CTA is deliberately NOT named "Start Your
 * Application": each public page owns exactly one link with that name
 * (asserted by the page suites). Below md the links live behind a
 * hamburger disclosure (PublicNav); sticky + z-40 pins the bar to the
 * viewport top (the translucent bg + backdrop-blur is the scrolled-over
 * treatment) and anchors the overlay panel ABOVE the homepage content
 * wrapper (z-index 1) while staying under the skip link (z-index 50).
 * The .public-site-header class is a hook for globals.css's scoped
 * scroll-padding-top, which keeps EVERY scroll-into-view — fragment
 * jumps and focus-triggered scrolls alike (WCAG 2.4.11) — clear of
 * the pinned bar.
 * Brand mark: the official raster logo (styling round 2, 2026-07-18) —
 * decorative (empty alt), the brand NAME is always the adjacent text.
 */
export function PublicHeader() {
  return (
    <header className="public-site-header sticky top-0 z-40 border-b border-base-300/70 bg-base-100/85 backdrop-blur">
      <nav
        aria-label="Public"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-x-4 px-4 py-2 sm:px-6 md:py-3"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src="/images/logo-official.png"
            alt=""
            width={1069}
            height={1074}
            className="h-8 w-8 object-contain"
          />
          Project Nova
        </Link>
        <PublicNav />
      </nav>
    </header>
  );
}

/** Public site footer — brand line only until About/Contact pages exist. */
export function PublicFooter() {
  return (
    <footer className="border-t border-base-300/70 bg-base-200/50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-4 py-8 text-sm text-base-content/60 sm:px-6">
        <p className="flex items-center gap-2 font-medium text-base-content/80">
          <Image
            src="/images/logo-official.png"
            alt=""
            width={1069}
            height={1074}
            className="h-6 w-6 object-contain"
          />
          Project Nova
        </p>
        <p>Paid transitional work, real support, and a path toward lasting employment.</p>
      </div>
    </footer>
  );
}
