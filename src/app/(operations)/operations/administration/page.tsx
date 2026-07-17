import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Administration" };

/** Operations administration index (Story 1.8). */
export default function AdministrationPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Administration" />
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
        <li>
          <Link
            href="/operations/administration/audit"
            className="text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Audit review
          </Link>
          <p className="text-sm text-base-content/70">
            Review who accessed or performed sensitive actions (restricted).
          </p>
        </li>
      </ul>
    </section>
  );
}
