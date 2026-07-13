"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

import type { WorkspaceTab } from "@/server/services/placement-service";

/**
 * The workspace tab strip (Story 5.1): a keyboard-operable tablist with
 * roving tabindex and arrow-key movement (docs/ux/accessibility.md).
 * Selection navigates ?tab= so content renders — and is permission-
 * shaped — on the server; the tabs prop is already role-shaped, so a tab
 * absent from the view model has no client trace either. Mobile-first:
 * the strip scrolls horizontally inside its own container; the page
 * never scrolls sideways.
 */
export function WorkspaceTabNav({
  tabs,
  labels,
  activeTab,
  basePath,
}: {
  tabs: WorkspaceTab[];
  labels: Record<WorkspaceTab, string>;
  activeTab: WorkspaceTab;
  basePath: string;
}) {
  const router = useRouter();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(tab: WorkspaceTab) {
    router.push(`${basePath}?tab=${tab}`, { scroll: false });
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next !== null) {
      event.preventDefault();
      refs.current[next]?.focus();
      select(tabs[next]);
    }
  }

  return (
    <div role="tablist" aria-label="Placement detail" className="flex gap-1 overflow-x-auto border-b border-base-300 pb-px">
      {tabs.map((tab, index) => {
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            ref={(element) => {
              refs.current[index] = element;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm transition-colors ${
              active
                ? "border-b-2 border-primary font-semibold text-base-content"
                : "text-base-content/70 hover:bg-base-200"
            }`}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}
