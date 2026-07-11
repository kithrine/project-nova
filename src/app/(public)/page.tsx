export default function HomePage() {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6 lg:max-w-3xl">
        <p className="text-sm font-medium text-secondary">Paid transitional work that matters</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Project Nova
        </h1>
        <p className="max-w-prose text-lg leading-relaxed text-base-content/80">
          Project Nova helps people returning from incarceration enter paid, meaningful
          transitional work at animal shelters — building skills, credentials, and a path
          toward sustainable employment.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-content transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            See How It Works
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
      </section>
    </main>
  );
}
