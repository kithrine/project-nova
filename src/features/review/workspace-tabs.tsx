"use client";

import Link from "next/link";
import { useRef } from "react";

/**
 * Application Workspace tabs (Story 2.7) — the accessible tabs pattern with
 * ARIA tab roles and roving tabindex (docs/ux/accessibility.md). Each tab is
 * a link that navigates to ?tab=…, so only the ACTIVE panel is ever rendered
 * server-side and restricted content stays out of the payload entirely
 * (AC3). Arrow keys rove focus; Enter/Space activates (manual activation,
 * per the APG tabs pattern).
 */

export interface WorkspaceTabItem {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

export function WorkspaceTabs({ tabs }: { tabs: WorkspaceTabItem[] }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    let target: number | null = null;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    if (target !== null) {
      event.preventDefault();
      refs.current[target]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Application workspace sections"
      className="flex gap-1 overflow-x-auto border-b border-base-300"
    >
      {tabs.map((tab, index) => (
        <Link
          key={tab.key}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={`tab-${tab.key}`}
          role="tab"
          href={tab.href}
          aria-selected={tab.selected}
          aria-controls="workspace-panel"
          tabIndex={tab.selected ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={[
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.selected
              ? "border-primary text-primary"
              : "border-transparent text-base-content/70 hover:border-base-300 hover:text-base-content",
          ].join(" ")}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
