import Image from "next/image";
import Link from "next/link";

/**
 * Public site header (Story 2.1; brand refresh 2026-07-15). Minimal
 * navigation for the public pages that exist today — links are added as
 * their pages are built (no dead links). The chartreuse "Apply Now" CTA
 * is deliberately NOT named "Start Your Application": each public page
 * owns exactly one link with that name (asserted by the page suites).
 * flex-wrap keeps the row from ever forcing horizontal scroll at 360px.
 * Brand mark: the official raster logo (styling round 2, 2026-07-18) —
 * decorative (empty alt), the brand NAME is always the adjacent text.
 */
export function PublicHeader() {
  return (
    <header className="border-b border-base-300/70 bg-base-100/85 backdrop-blur">
      <nav
        aria-label="Public"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6"
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
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <div className="flex items-center gap-1 rounded-full border border-base-300 bg-base-100/70 p-1">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Home
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full px-3 py-1.5 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              How It Works
            </Link>
          </div>
          <Link
            href="/sign-in"
            className="rounded-full px-3 py-1.5 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Log In
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-accent px-4 py-1.5 font-semibold text-accent-content transition-colors hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Apply Now
          </Link>
        </div>
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
