import type { ExportDefinition } from "@/server/services/export-service";

/**
 * Named-export picker (Story 7.5). Each export opens a disclosure that
 * IS the confirmation step: the complete field allow-list, the audit
 * notice, and only then the download control. Server-rendered; the
 * download itself is the Route Handler streaming a CSV (ADR-021 —
 * nothing is stored).
 */

export function ExportPicker({
  definitions,
}: {
  definitions: readonly ExportDefinition[];
}) {
  return (
    <ul aria-label="Named exports" className="flex max-w-2xl flex-col gap-2">
      {definitions.map((definition) => (
        <li
          key={definition.key}
          className="rounded-md border border-base-300 bg-base-100"
        >
          <details>
            <summary className="cursor-pointer px-4 py-3">
              <span className="text-sm font-medium">{definition.name}</span>
              <span className="block text-xs text-base-content/60">
                {definition.description}
              </span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-3">
              {definition.provisional && (
                <p
                  role="note"
                  className="max-w-prose rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs"
                >
                  Provisional pilot format — pending validation against executed
                  award documents (ADR-020).
                </p>
              )}
              <div>
                <p className="text-xs font-medium">
                  This export contains exactly these fields:
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {definition.columns.map((column) => (
                    <li
                      key={column}
                      className="rounded border border-base-300 bg-base-200/60 px-2 py-0.5 text-xs"
                    >
                      {column}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="max-w-prose text-xs text-base-content/70">
                Downloading records an audit event with your name, the export
                name, its scope, and the time. The file is generated for this
                download only — nothing is stored.
              </p>
              <a
                href={`/api/exports/${definition.key}`}
                download
                className="btn btn-primary btn-sm self-start"
              >
                Download {definition.name}
              </a>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
