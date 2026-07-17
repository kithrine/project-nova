"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icons";
import type { NavItem } from "@/components/layout/nav-model";

/**
 * Navigation list with active-route awareness (brand pass 2026-07-16).
 * The one deliberately-client piece of the shell: `usePathname` gives
 * `aria-current="page"` without threading route info through server
 * layouts. Two tones: "sidebar" renders on the deep-teal rail (focus
 * ring is ACCENT there — the global primary ring would vanish on teal,
 * docs/ux/accessibility.md), "sheet" renders on cream in the mobile
 * disclosure. Structure is unchanged from the original shell: available
 * items are Links, unavailable ones are aria-disabled spans, icons stay
 * decorative.
 */
export function AppShellNav({
  items,
  tone,
}: {
  items: readonly NavItem[];
  tone: "sidebar" | "sheet";
}) {
  const pathname = usePathname();

  // Dashboard roots ("/participant", "/shelter", "/operations") match
  // exactly; deeper destinations also match their sub-pages.
  const isActive = (href: string) =>
    pathname === href ||
    (href.split("/").length > 2 && (pathname?.startsWith(`${href}/`) ?? false));

  const linkClasses = (active: boolean) =>
    tone === "sidebar"
      ? active
        ? "flex items-center gap-3 rounded-full bg-gradient-to-r from-accent to-base-100 px-4 py-2 text-sm font-semibold text-accent-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        : "flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-base-100 transition-colors duration-(--duration-fast) hover:bg-base-100/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      : active
        ? "flex items-center gap-3 rounded-md bg-accent/20 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        : "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  const disabledClasses =
    tone === "sidebar"
      ? "flex cursor-not-allowed items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-base-100/60"
      : "flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-base-content/40";

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) =>
        item.available ? (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={linkClasses(isActive(item.href))}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ) : (
          <li key={item.href}>
            <span aria-disabled="true" className={disabledClasses}>
              <NavIcon name={item.icon} />
              {item.label}
              <span className="sr-only">(coming soon)</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
