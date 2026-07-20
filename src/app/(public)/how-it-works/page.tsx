import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BreathingDots } from "@/components/decor/breathing-dots";
import { NovaLogo } from "@/components/layout/nova-logo";

import styles from "./how-it-works.module.css";
import { Reveal } from "./reveal";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Project Nova offers paid transitional work at animal shelters, with training, support, and a path toward lasting employment. Here's how the journey works.",
};

/** Small hand-drawn paw print used along the trail (SVG only — no emojis). */
function Paw({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <ellipse cx="9" cy="5.4" rx="1.9" ry="2.5" />
      <ellipse cx="15" cy="5.4" rx="1.9" ry="2.5" />
      <ellipse cx="4.9" cy="9.6" rx="1.8" ry="2.3" transform="rotate(-20 4.9 9.6)" />
      <ellipse cx="19.1" cy="9.6" rx="1.8" ry="2.3" transform="rotate(20 19.1 9.6)" />
      <path d="M12 10.2c2.6 0 5.4 2.1 5.4 4.9 0 2.3-1.7 3.7-3.4 3.7-.8 0-1.4-.3-2-.3s-1.2.3-2 .3c-1.7 0-3.4-1.4-3.4-3.7 0-2.8 2.8-4.9 5.4-4.9z" />
    </svg>
  );
}

/*
 * Card icons (round 5) — Lucide-derived paths (ISC license) inlined as
 * local aria-hidden components, the same idiom as the homepage quartet.
 */

/** Hand offering coins — "Real paid work" (Lucide "hand-coins"). */
function HandCoins({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 16 6 6" />
      <circle cx="16" cy="9" r="2.9" />
      <circle cx="6" cy="5" r="3" />
    </svg>
  );
}

/** Heart with clasped hands — "Support that stays" (Lucide "heart-handshake"). */
function HeartHandshake({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66" />
      <path d="m18 15-2-2" />
      <path d="m15 18-2-2" />
    </svg>
  );
}

/** Backpack — "What you bring" (Lucide "backpack"). */
function Backpack({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" />
      <path d="M8 10h8" />
    </svg>
  );
}

/** Life buoy — "What we bring" (Lucide "life-buoy"). */
function LifeBuoy({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/** Ground trot for the ball chase. Positions/rotations are static inline
 *  styles — only opacity animates, so they can never conflict.
 *
 *  Width-adaptive stride (round 5 follow-up): paw i sits at
 *  calc(4% + (96% − 100px) × i/9) — an even arithmetic walk from the
 *  left margin to the final paw, whose left resolves to 100% − 100px
 *  (right: 58 + its 42px glyph), i.e. right beside the ball's
 *  px-anchored resting spot. Mixing % and px in ONE calc per paw means
 *  the stride interpolates smoothly at every viewport width — pure
 *  %-positions left a growing dead zone before the px-anchored finale
 *  on wide monitors (the corner-cluster Kit saw on a 32" screen).
 *  mobileHidden thins the trot on phones so ~6 paws never crowd. */
const pawLeft = (i: number) => `calc(4% + (96% - 100px) * ${i} / 9)`;

const CHASE_PAWS: ReadonlyArray<{
  left?: string;
  right?: number;
  bottom: number;
  size: number;
  rotate: number;
  color: string;
  mobileHidden?: boolean;
}> = [
  { left: pawLeft(0), bottom: 36, size: 36, rotate: 84, color: "var(--color-secondary)" },
  { left: pawLeft(1), bottom: 20, size: 37, rotate: 98, color: "var(--color-accent)", mobileHidden: true },
  { left: pawLeft(2), bottom: 35, size: 36, rotate: 80, color: "var(--color-secondary)" },
  { left: pawLeft(3), bottom: 21, size: 38, rotate: 100, color: "var(--color-accent)", mobileHidden: true },
  { left: pawLeft(4), bottom: 36, size: 37, rotate: 84, color: "var(--color-secondary)" },
  { left: pawLeft(5), bottom: 20, size: 39, rotate: 96, color: "var(--color-accent)", mobileHidden: true },
  { left: pawLeft(6), bottom: 35, size: 38, rotate: 82, color: "var(--color-secondary)" },
  { left: pawLeft(7), bottom: 21, size: 40, rotate: 98, color: "var(--color-accent)" },
  { left: pawLeft(8), bottom: 35, size: 40, rotate: 84, color: "var(--color-secondary)", mobileHidden: true },
  { right: 58, bottom: 20, size: 42, rotate: 96, color: "var(--color-accent)" },
];

/* Card tone classes (round 5) — the same CSS-var contract as the
   homepage quartet (ink + low-opacity washes of one color); explicit
   per-card classes, never structural selectors. */
const CARD_TONE = {
  brightTeal: styles.toneBrightTeal,
  chartreuse: styles.toneChartreuse,
  darkTeal: styles.toneDarkTeal,
  yellow: styles.toneYellow,
} as const;

const JOURNEY_STEPS = [
  {
    title: "Start your application",
    body: "Tell us about yourself in plain questions — no trick wording, no test. You can save your progress and come back anytime.",
  },
  {
    title: "We get to know each other",
    body: "Our team reviews your application and meets with you for a real conversation. Eligibility is determined during this review, and we keep you informed at every step.",
  },
  {
    title: "Get ready",
    body: "Before your placement starts, you complete onboarding and hands-on training — and earn certifications that stay with you wherever you go next.",
  },
  {
    title: "Match with a shelter",
    body: "We propose a placement that fits your schedule, strengths, and transportation. You see the details and decide — a match only moves forward when it works for you too.",
  },
  {
    title: "Work with the animals",
    body: "Paid transitional work at a partner animal shelter, with a supervisor on site and a Project Nova coordinator in your corner. Your hours are tracked and approved every week.",
  },
  {
    title: "Step into what's next",
    body: "As your placement winds down, we work with you on the move to permanent employment — building on the record, skills, and references you've earned.",
  },
];

export default function HowItWorksPage() {
  return (
    <main id="main-content" className={`${styles.page} flex flex-1 flex-col`}>
      <div className={styles.content}>
        {/* Full-bleed photo hero (styling round 2, 2026-07-18): the image
            spans the viewport; a left-weighted scrim keeps the (unchanged)
            hero copy readable, so the text flips to cream with the accent
            phrase in chartreuse italic — permitted on dark surfaces. */}
        <section className={styles.heroBand}>
          <Image
            src="/images/how-it-works-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroBandImage}
          />
          <div className={styles.heroScrim} aria-hidden="true" />
          {/* max-w-7xl (round 3): the wider container starts the copy well
              left of center, keeping the people and dogs — the image's
              focal point — in the clear. */}
          <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <div className={`${styles.heroReveal} relative flex max-w-2xl flex-col gap-6`}>
              <p className={`${styles.eyebrow} ${styles.eyebrowOnImage}`}>
                <NovaLogo className="size-3.5" />
                Workforce impact. Community change.
              </p>
              <h1 className={`${styles.display} ${styles.heroTitle} ${styles.heroBandTitle}`}>
                Good work, real pay,{" "}
                <span className={styles.heroBandAccent}>and a team that shows up</span>{" "}
                for you.
              </h1>
              <p className={`${styles.heroBandText} max-w-prose text-lg leading-relaxed`}>
                Project Nova helps people returning from incarceration step into paid,
                meaningful work caring for shelter animals — with training, steady support,
                and a clear path toward lasting employment.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-content shadow-sm transition-[color,background-color,box-shadow,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:shadow-sm"
                >
                  Start Your Application
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 transition-transform motion-safe:group-hover:translate-x-1"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <a
                  href="#journey"
                  className={`${styles.heroBandText} text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                >
                  See the journey
                </a>
              </div>
              <p className={`${styles.heroBandFaint} text-sm`}>
                Free to start. Create an account, answer at your own pace, and save your
                progress anytime.
              </p>
            </div>
          </div>
        </section>

        {/* The ball chase (visual pass 2026-07-18; widened full-bleed with
            bigger chartreuse/teal paws in styling round 2): a red toy ball
            bounces in from the left and settles at the right; paw prints
            trot after it before the scene clears and loops. One master 9s
            cycle — every element animates at the same duration, paw
            offsets via animation-delay, so phases can never drift. Paws
            are HTML-positioned spans, NOT nested in one big SVG viewBox
            (Tailwind sizing cannot constrain an inner SVG's coordinate
            system — the bug that broke the old trail). Reduced motion:
            ball at rest with its contact shadow and a faded trail. */}
        {/* Runs on every viewport (round 5) — mobileHidden thins the trot
            on phones instead of hiding the whole scene. */}
        <div aria-hidden="true" className={`${styles.chase} w-full`}>
          <div className={styles.ballTrack}>
            <div className={styles.ballBounce}>
              <div className={styles.ball} />
            </div>
            <div className={styles.ballShadow} />
          </div>
          {CHASE_PAWS.map((paw, index) => (
            <span
              key={index}
              className={`${styles.chasePaw}${paw.mobileHidden ? " max-sm:hidden" : ""}`}
              style={{
                left: paw.left,
                right: paw.right,
                bottom: paw.bottom,
                width: paw.size,
                height: paw.size,
                color: paw.color,
                transform: `rotate(${paw.rotate}deg)`,
              }}
            >
              <Paw className={styles.chasePawIcon} />
            </span>
          ))}
        </div>

        {/* ------------------------------------------------- What this is */}
        <section aria-labelledby="what-heading" className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
          <Reveal className={styles.reveal}>
            <h2 id="what-heading" className={`${styles.display} text-3xl font-semibold sm:text-4xl`}>
              What Project Nova is
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Real paid work",
                body: "A transitional placement at a partner animal shelter — real responsibilities, real wages, real experience for your résumé.",
                icon: <HandCoins className="size-5" />,
                tone: "brightTeal" as const,
              },
              {
                title: "Training that counts",
                body: "Hands-on training and certifications in animal care that you keep, whatever comes next.",
                icon: <Paw className="size-5" />,
                tone: "chartreuse" as const,
              },
              {
                title: "Support that stays",
                body: "A coordinator who knows you and a supervisor on site — people whose job is to help you succeed.",
                icon: <HeartHandshake className="size-5" />,
                tone: "yellow" as const,
              },
            ].map((card, index) => (
              <Reveal key={card.title} className={styles.reveal} delayMs={index * 120}>
                <div
                  className={`${styles.stepCard} ${CARD_TONE[card.tone]} flex h-full flex-col gap-3 rounded-lg p-6`}
                >
                  <div className={styles.cardIcon}>{card.icon}</div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-base-content/75">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- The journey */}
        {/* The band wrapper anchors the half-circle breathing dot field to
            the VIEWPORT's left edge at the stepper's height (Kit's doodle);
            the section markup inside is unchanged. */}
        <div className={styles.journeyBand}>
          <BreathingDots anchor="left-center" className={styles.journeyDots} />
          <section
            id="journey"
            aria-labelledby="journey-heading"
            className="relative mx-auto w-full max-w-5xl scroll-mt-8 px-4 pb-20 sm:px-6"
          >
          <Reveal className={styles.reveal}>
            <h2 id="journey-heading" className={`${styles.display} text-3xl font-semibold sm:text-4xl`}>
              How the journey works
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-base-content/75">
              Six steps, one at a time. You’ll always know where you are and what happens
              next.
            </p>
          </Reveal>

          <ol className={`${styles.railList} mt-10 flex list-none flex-col gap-6`}>
            {JOURNEY_STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 sm:gap-6">
                <div
                  aria-hidden="true"
                  className={`${styles.stepNumber} z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-secondary/40 bg-base-100 text-secondary`}
                >
                  {index + 1}
                </div>
                <Reveal
                  className={`${styles.reveal} min-w-0 flex-1`}
                  delayMs={80}
                  from={index % 2 ? "right" : "left"}
                >
                  <div className={`${styles.stepCard} rounded-lg p-5 sm:p-6`}>
                    <h3 className={`${styles.display} text-xl font-semibold text-primary`}>
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-base-content/75 sm:text-base">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          </section>
        </div>

        {/* -------------------------------------------------- Expectations */}
        <section
          aria-labelledby="expectations-heading"
          className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6"
        >
          <Reveal className={styles.reveal}>
            <h2
              id="expectations-heading"
              className={`${styles.display} text-3xl font-semibold sm:text-4xl`}
            >
              What to expect
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Reveal className={styles.reveal} from="left">
              <div
                className={`${styles.stepCard} ${styles.expectCard} ${CARD_TONE.chartreuse} h-full rounded-lg p-6`}
              >
                <div className="flex items-center gap-3">
                  <div className={styles.cardIcon}>
                    <Backpack className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">What you bring</h3>
                </div>
                <ul className="mt-4 flex list-none flex-col gap-2 text-sm leading-relaxed text-base-content/75">
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    Showing up — for your schedule, your team, and the animals
                  </li>
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    Willingness to learn, even when it’s new or hard
                  </li>
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    Care — animals depend on the people around them
                  </li>
                </ul>
              </div>
            </Reveal>
            <Reveal className={styles.reveal} delayMs={120} from="right">
              <div
                className={`${styles.stepCard} ${styles.expectCard} ${CARD_TONE.darkTeal} h-full rounded-lg p-6`}
              >
                <div className="flex items-center gap-3">
                  <div className={styles.cardIcon}>
                    <LifeBuoy className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">What we bring</h3>
                </div>
                <ul className="mt-4 flex list-none flex-col gap-2 text-sm leading-relaxed text-base-content/75">
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    Paid transitional work and training that leads to certifications
                  </li>
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    A coordinator and an on-site supervisor who want you to succeed
                  </li>
                  <li className="flex gap-2">
                    <Paw className={`${styles.toneInk} mt-0.5 size-4 shrink-0`} />
                    Honest communication about where you are and what’s next
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal className={styles.reveal}>
            <div className="mt-8 rounded-lg border border-warning/30 bg-warning/5 p-6">
              <h3 className="text-lg font-semibold">Who can apply</h3>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-base-content/80 sm:text-base">
                Anyone can start an application, and we review every one. Eligibility is
                determined during the review process — starting an application isn’t a
                guarantee of acceptance, and we’ll be straight with you about where things
                stand at every step. If now isn’t the right time, you may apply again
                later.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ------------------------------------------------------- Closing */}
        <section aria-labelledby="closing-heading" className={styles.closing}>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-start gap-5">
              <Paw className="size-8 text-accent/80" />
              <h2
                id="closing-heading"
                className={`${styles.display} max-w-xl text-3xl font-semibold sm:text-4xl`}
              >
                Ready when you are.
              </h2>
              <p className="max-w-prose text-base leading-relaxed text-base-100/90">
                Creating your account is the first step — the application itself is plain
                questions, at your pace, saved as you go.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md border border-base-100/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-[color,background-color,border-color,box-shadow,transform] hover:border-base-100/70 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:shadow-none"
              >
                Create Your Account
              </Link>
            </div>
            {/* Heart-masked photo (round 5): decorative, non-interactive —
                the closing band's no-focusables rule holds. */}
            <div className={styles.heartWrap} aria-hidden="true">
              <Image
                src="/images/dog-kiss.png"
                alt=""
                width={1672}
                height={941}
                className={styles.heartImage}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
