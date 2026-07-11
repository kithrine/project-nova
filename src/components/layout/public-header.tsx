import Link from "next/link";

/**
 * Public site header (Story 2.1). Minimal navigation for the public pages
 * that exist today — links are added as their pages are built (no dead
 * links). The single primary CTA lives on the page, not here.
 */
export function PublicHeader() {
  return (
    <header className="border-b border-base-300/60 bg-transparent">
      <nav
        aria-label="Public"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6 text-secondary"
          >
            {/* Paw mark — Project Nova's shelter-work signature */}
            <ellipse cx="9" cy="5.4" rx="1.9" ry="2.5" />
            <ellipse cx="15" cy="5.4" rx="1.9" ry="2.5" />
            <ellipse cx="4.9" cy="9.6" rx="1.8" ry="2.3" transform="rotate(-20 4.9 9.6)" />
            <ellipse cx="19.1" cy="9.6" rx="1.8" ry="2.3" transform="rotate(20 19.1 9.6)" />
            <path d="M12 10.2c2.6 0 5.4 2.1 5.4 4.9 0 2.3-1.7 3.7-3.4 3.7-.8 0-1.4-.3-2-.3s-1.2.3-2 .3c-1.7 0-3.4-1.4-3.4-3.7 0-2.8 2.8-4.9 5.4-4.9z" />
          </svg>
          Project Nova
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/how-it-works"
            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            How It Works
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-base-300 px-3 py-1.5 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}

/** Public site footer — brand line only until About/Contact pages exist. */
export function PublicFooter() {
  return (
    <footer className="border-t border-base-300/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-8 text-sm text-base-content/60 sm:px-6">
        <p className="font-medium text-base-content/80">Project Nova</p>
        <p>Paid transitional work, real support, and a path toward lasting employment.</p>
      </div>
    </footer>
  );
}
