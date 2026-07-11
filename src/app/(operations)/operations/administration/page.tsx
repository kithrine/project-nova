import Link from "next/link";

export const metadata = { title: "Administration" };

/** Operations administration index (Story 1.8). */
export default function AdministrationPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      <ul className="flex flex-col gap-2">
        <li>
          <Link
            href="/operations/administration/funding-sources"
            className="text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Funding sources
          </Link>
          <p className="text-sm text-base-content/70">
            Manage the grants and contracts that fund placements.
          </p>
        </li>
      </ul>
    </section>
  );
}
