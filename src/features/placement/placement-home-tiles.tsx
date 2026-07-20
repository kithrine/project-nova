import { NavIcon } from "@/components/layout/nav-icons";
import { StatCard } from "@/components/ui/stat-card";
import type { ParticipantPlacementView } from "@/server/services/placement-service";
import type { OwnWeekHoursView } from "@/server/services/timesheet-service";

/**
 * The placed participant's dashboard tiles: site, schedule, this week's
 * hours, and certifications — what a working participant checks day to
 * day. Pure presentation over role-shaped view models; each link leads
 * to the surface that owns the data (My Placement, My Hours,
 * Certifications), mirroring those nav items' icons.
 */
export function PlacementHomeTiles({
  placement,
  weekHours,
  certificationCount,
}: {
  placement: ParticipantPlacementView;
  weekHours: OwnWeekHoursView | null;
  certificationCount: number;
}) {
  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <StatCard
        label="Your site"
        value={placement.siteName}
        sublabel={placement.organizationName}
        icon={<NavIcon name="building" className="size-5" />}
        tone="primary"
      />
      <StatCard
        label="Schedule"
        value={placement.scheduleSummary ?? "Being set up"}
        sublabel="Review Placement"
        href="/participant/placement"
        icon={<NavIcon name="briefcase" className="size-5" />}
        tone="accent"
      />
      <StatCard
        label="This week's hours"
        value={weekHours?.totalHours ?? "0.00"}
        sublabel="Add or review hours"
        href="/participant/hours"
        icon={<NavIcon name="clock" className="size-5" />}
        tone="success"
      />
      <StatCard
        label="Certifications"
        value={certificationCount}
        sublabel="See what's on record"
        href="/participant/certifications"
        icon={<NavIcon name="award" className="size-5" />}
        tone="accent"
      />
    </div>
  );
}
