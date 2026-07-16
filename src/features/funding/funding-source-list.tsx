import Link from "next/link";

import type { FundingSourceView } from "@/server/services/funding-source-service";

/**
 * Funding-source list (Story 1.8). Status is text, never color alone;
 * mobile-first: the table scrolls inside its own container.
 */
export function FundingSourceList({ sources }: { sources: FundingSourceView[] }) {
  if (sources.length === 0) {
    return (
      <p className="rounded-md border border-base-300 bg-base-200 px-4 py-6 text-sm text-base-content/70">
        No funding sources yet. Create the first one below.
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md border border-base-300"
      tabIndex={0}
      role="region"
      aria-label="Funding sources table"
    >
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-base-300 bg-base-200 text-xs uppercase tracking-wide text-base-content/70">
          <tr>
            <th scope="col" className="px-4 py-2">
              Name
            </th>
            <th scope="col" className="px-4 py-2">
              Kind
            </th>
            <th scope="col" className="px-4 py-2">
              Code
            </th>
            <th scope="col" className="px-4 py-2">
              Status
            </th>
            <th scope="col" className="px-4 py-2">
              Dates
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-b border-base-300 last:border-b-0">
              <td className="px-4 py-2 font-medium">
                <Link
                  href={`/operations/administration/funding-sources/${source.id}`}
                  className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {source.name}
                </Link>
              </td>
              <td className="px-4 py-2">{source.kindLabel}</td>
              <td className="px-4 py-2">{source.code ?? "—"}</td>
              <td className="px-4 py-2">{source.statusLabel}</td>
              <td className="px-4 py-2 text-base-content/70">
                {source.startDate ?? "—"} to {source.endDate ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
