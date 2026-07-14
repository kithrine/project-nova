import type { NavIconName } from "@/components/layout/nav-icons";
import type { Experience } from "@/server/auth/experience";

/**
 * Navigation models (Story 1.7) — one per experience, exactly matching
 * docs/ux/information-architecture.md. Items whose pages arrive in later
 * epics are `available: false` and render as disabled entries (the
 * Disabled screen state, docs/ux/wireframe-spec.md) rather than dead links.
 * Flip `available` in the story that builds the page.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  available: boolean;
}

export const PARTICIPANT_NAV: readonly NavItem[] = [
  { label: "Dashboard", href: "/participant", icon: "home", available: true },
  { label: "My Application", href: "/participant/application", icon: "file", available: true },
  { label: "My Placement", href: "/participant/placement", icon: "briefcase", available: true },
  { label: "My Hours", href: "/participant/hours", icon: "clock", available: true },
  { label: "Certifications", href: "/participant/certifications", icon: "award", available: true },
  { label: "Profile", href: "/participant/profile", icon: "user", available: false },
  { label: "Help", href: "/participant/help", icon: "help", available: false },
];

export const SHELTER_NAV: readonly NavItem[] = [
  { label: "Dashboard", href: "/shelter", icon: "home", available: true },
  { label: "Participants", href: "/shelter/participants", icon: "users", available: false },
  { label: "Placements", href: "/shelter/placements", icon: "briefcase", available: true },
  { label: "Timesheets", href: "/shelter/timesheets", icon: "clock", available: true },
  { label: "Evaluations", href: "/shelter/evaluations", icon: "clipboard", available: false },
  { label: "Incidents", href: "/shelter/incidents", icon: "alert", available: false },
  { label: "Organization", href: "/shelter/organization", icon: "building", available: false },
];

export const OPERATIONS_NAV: readonly NavItem[] = [
  { label: "Dashboard", href: "/operations", icon: "home", available: true },
  { label: "Applications", href: "/operations/applications", icon: "file", available: true },
  { label: "Participants", href: "/operations/participants", icon: "users", available: false },
  { label: "Placements", href: "/operations/placements", icon: "briefcase", available: true },
  { label: "Shelters", href: "/operations/shelters", icon: "building", available: false },
  { label: "Training", href: "/operations/training", icon: "book", available: false },
  { label: "Reports", href: "/operations/reports", icon: "chart", available: false },
  { label: "Administration", href: "/operations/administration", icon: "settings", available: true },
];

export const NAV_BY_EXPERIENCE: Record<Experience, readonly NavItem[]> = {
  participant: PARTICIPANT_NAV,
  shelter: SHELTER_NAV,
  operations: OPERATIONS_NAV,
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  participant: "Participant",
  shelter: "Shelter",
  operations: "Nova Operations",
};
