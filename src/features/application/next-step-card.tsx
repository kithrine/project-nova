import type { JourneyNextStep } from "@/server/services/application-journey";

/**
 * Next Step Card (Story 2.6; docs/ux/component-guidelines.md). One calm
 * card that always answers "what happens now?" — an action to take, a
 * reassurance that none is needed, a warm acceptance, or a respectful
 * closure. The sr-only status line announces the current stage to assistive
 * technology when it changes on a revisit (docs/ux/accessibility.md); tone
 * is always conveyed by icon + text together, never color alone.
 */

function ToneIcon({ tone }: { tone: JourneyNextStep["tone"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (tone) {
    case "action":
      // arrow in a circle: something to do
      return (
        <svg {...common} className="size-6 shrink-0 text-primary">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h7m0 0-2.5-2.5M15 12l-2.5 2.5" />
        </svg>
      );
    case "waiting":
      // clock: in good hands, nothing needed
      return (
        <svg {...common} className="size-6 shrink-0 text-secondary">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "positive":
      // check in a circle: welcome aboard
      return (
        <svg {...common} className="size-6 shrink-0 text-success">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
      );
    case "closed":
      // neutral pause: closed with respect
      return (
        <svg {...common} className="size-6 shrink-0 text-base-content/60">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9v6m4-6v6" />
        </svg>
      );
  }
}

const TONE_SURFACE: Record<JourneyNextStep["tone"], string> = {
  action: "border-primary/30 bg-primary/5",
  waiting: "border-base-300 bg-base-200/50",
  positive: "border-success/30 bg-success/5",
  closed: "border-base-300 bg-base-200/50",
};

export function NextStepCard({
  step,
  stageLabel,
}: {
  step: JourneyNextStep;
  stageLabel: string;
}) {
  return (
    <div className={`max-w-2xl rounded-lg border p-5 sm:p-6 ${TONE_SURFACE[step.tone]}`}>
      <p role="status" className="sr-only">
        Current stage: {stageLabel}. {step.headline}.
      </p>
      <div className="flex items-start gap-3">
        <ToneIcon tone={step.tone} />
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold leading-snug">{step.headline}</h2>
          <p className="max-w-prose text-base leading-relaxed text-base-content/80">
            {step.description}
          </p>
          {step.actionLabel && step.actionHref ? (
            <a
              href={step.actionHref}
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90"
            >
              {step.actionLabel}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M5 12h13m0 0-4-4m4 4-4 4" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
