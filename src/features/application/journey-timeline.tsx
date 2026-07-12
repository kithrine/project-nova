import type { JourneyStep } from "@/server/services/application-journey";

/**
 * Journey Timeline (Story 2.6) — Project Nova's signature component
 * (docs/ux/visual-design-reference.md). Four simplified steps rendered as a
 * horizontal path: done steps are filled with a check, the current step
 * carries aria-current="step" and a gentle pulse (suppressed under reduced
 * motion), upcoming steps stay quiet. Every state is text + icon, never
 * color alone; mobile-first at 360px and up.
 */

function StepIcon({ state }: { state: JourneyStep["state"] }) {
  if (state === "done") {
    return (
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-content">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="m6 12.5 4 4 8-9" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative flex size-8 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 motion-reduce:hidden" />
        <span className="relative flex size-8 items-center justify-center rounded-full border-2 border-primary bg-base-100">
          <span className="size-2.5 rounded-full bg-primary" />
        </span>
      </span>
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full border-2 border-base-300 bg-base-100">
      <span className="size-2 rounded-full bg-base-300" />
    </span>
  );
}

const STATE_TEXT: Record<JourneyStep["state"], string> = {
  done: "completed",
  current: "current step",
  upcoming: "not started yet",
};

export function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol aria-label="Your application journey" className="flex w-full max-w-2xl">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex flex-1 flex-col items-center gap-2"
        >
          <div className="flex w-full items-center">
            <span
              aria-hidden="true"
              className={[
                "h-0.5 flex-1 rounded-full",
                index === 0
                  ? "invisible"
                  : step.state === "upcoming"
                    ? "bg-base-300"
                    : "bg-primary",
              ].join(" ")}
            />
            <StepIcon state={step.state} />
            <span
              aria-hidden="true"
              className={[
                "h-0.5 flex-1 rounded-full",
                index === steps.length - 1
                  ? "invisible"
                  : step.state === "done"
                    ? "bg-primary"
                    : "bg-base-300",
              ].join(" ")}
            />
          </div>
          <span
            className={[
              "text-xs font-medium sm:text-sm",
              step.state === "current" ? "text-primary" : "text-base-content/70",
            ].join(" ")}
          >
            {step.label}
            <span className="sr-only"> — {STATE_TEXT[step.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
