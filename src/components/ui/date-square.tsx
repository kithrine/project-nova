/**
 * Structured date parts a service view supplies alongside its formatted
 * label — the square renders month/day, the full date is what assistive
 * tech reads.
 */
export interface DateParts {
  /** Short month, e.g. "Jul". */
  month: string;
  /** Day of month, e.g. "3". */
  day: string;
  /** Four-digit year, e.g. "2026" — the tile omits it; callers may show it alongside. */
  year: string;
  /** The complete date for assistive tech, e.g. "July 3, 2026". */
  full: string;
}

/**
 * Date square (brand follow-ups 2026-07-17): the teal month-over-day tile
 * from the approved dashboard mockup. Purely presentational — services
 * supply DateParts so the tile never re-derives dates client-side. The
 * month/day glyphs are aria-hidden; the full date is exposed once via
 * role="img" so screen readers hear "July 3, 2026", not "Jul" then "3".
 */
export function DateSquare({ parts }: { parts: DateParts }) {
  return (
    <span
      role="img"
      aria-label={parts.full}
      className="inline-flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-primary leading-none text-primary-content"
    >
      <span aria-hidden="true" className="text-[0.6rem] font-semibold uppercase tracking-wide">
        {parts.month}
      </span>
      <span aria-hidden="true" className="mt-0.5 text-base font-bold tabular-nums">
        {parts.day}
      </span>
    </span>
  );
}
