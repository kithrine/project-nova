/**
 * Project Nova brand mark — a compass star (a nova, a guiding light).
 * Single-color via currentColor so consumers set the tone with a text-*
 * class; always decorative (the brand NAME is adjacent text, never the
 * icon alone).
 */
export function NovaLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {/* Four long cardinal points */}
      <path d="M12 1.75 14.1 9.9 22.25 12 14.1 14.1 12 22.25 9.9 14.1 1.75 12 9.9 9.9Z" />
      {/* Short diagonal rays */}
      <path
        d="M17.7 6.3 16.1 7.9M7.9 16.1 6.3 17.7M17.7 17.7 16.1 16.1M7.9 7.9 6.3 6.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}
