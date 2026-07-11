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
        <p className="max-w-prose text-base leading-relaxed text-base-content/70">
          Applications are not open yet. This site is under active development.
        </p>
      </section>
    </main>
  );
}
