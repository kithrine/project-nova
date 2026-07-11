import type { Metadata } from "next";
import Link from "next/link";

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
        {/* ---------------------------------------------------------- Hero */}
        <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
          <div className={`${styles.heroReveal} relative flex max-w-2xl flex-col gap-6`}>
            <p className="text-sm font-semibold tracking-wide text-secondary uppercase">
              Paid transitional work at animal shelters
            </p>
            <h1 className={`${styles.display} ${styles.heroTitle}`}>
              Good work, real pay,{" "}
              <span className={styles.heroTitleAccent}>and a team that shows up</span> for you.
            </h1>
            <p className="max-w-prose text-lg leading-relaxed text-base-content/80">
              Project Nova helps people returning from incarceration step into paid,
              meaningful work caring for shelter animals — with training, steady support,
              and a clear path toward lasting employment.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-content shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                  className="size-4"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <a
                href="#journey"
                className="text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                See the journey
              </a>
            </div>
            <p className="text-sm text-base-content/60">
              Free to start. Create an account, answer at your own pace, and save your
              progress anytime.
            </p>
          </div>

          {/* The walked path: draws itself, paws appear along the way */}
          <svg
            aria-hidden="true"
            viewBox="0 0 560 190"
            fill="none"
            className="mt-4 hidden w-full max-w-3xl text-secondary sm:block"
          >
            <path
              className={styles.trailPath}
              pathLength="1"
              d="M8 170 C 120 150, 150 60, 265 78 S 470 140, 552 34"
              stroke="currentColor"
              strokeOpacity="0.5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="0.5 2"
            />
            <g className={styles.trailPaw} transform="translate(96 128) rotate(24) scale(0.9)">
              <Paw className="size-5" />
            </g>
            <g className={styles.trailPaw} transform="translate(250 62) rotate(8)">
              <Paw className="size-5" />
            </g>
            <g className={styles.trailPaw} transform="translate(400 108) rotate(-14) scale(1.1)">
              <Paw className="size-6" />
            </g>
            <g className={styles.trailPaw} transform="translate(520 30) rotate(-30) scale(1.2)">
              <Paw className="size-6" />
            </g>
          </svg>
        </section>

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
              },
              {
                title: "Training that counts",
                body: "Hands-on training and certifications in animal care that you keep, whatever comes next.",
              },
              {
                title: "Support that stays",
                body: "A coordinator who knows you and a supervisor on site — people whose job is to help you succeed.",
              },
            ].map((card, index) => (
              <Reveal key={card.title} className={styles.reveal} delayMs={index * 120}>
                <div className={`${styles.stepCard} flex h-full flex-col gap-2 rounded-lg p-6`}>
                  <Paw className="size-6 text-secondary/70" />
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-base-content/75">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- The journey */}
        <section
          id="journey"
          aria-labelledby="journey-heading"
          className="mx-auto w-full max-w-5xl scroll-mt-8 px-4 pb-20 sm:px-6"
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
                  className={`${styles.stepNumber} z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-secondary/40 bg-[#faf7f1] text-secondary`}
                >
                  {index + 1}
                </div>
                <Reveal className={`${styles.reveal} min-w-0 flex-1`} delayMs={80}>
                  <div className={`${styles.stepCard} rounded-lg p-5 sm:p-6`}>
                    <h3 className={`${styles.display} text-xl font-semibold`}>{step.title}</h3>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-base-content/75 sm:text-base">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

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
            <Reveal className={styles.reveal}>
              <div className={`${styles.stepCard} h-full rounded-lg p-6`}>
                <h3 className="text-lg font-semibold">What you bring</h3>
                <ul className="mt-3 flex list-none flex-col gap-2 text-sm leading-relaxed text-base-content/75">
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
                    Showing up — for your schedule, your team, and the animals
                  </li>
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
                    Willingness to learn, even when it’s new or hard
                  </li>
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
                    Care — animals depend on the people around them
                  </li>
                </ul>
              </div>
            </Reveal>
            <Reveal className={styles.reveal} delayMs={120}>
              <div className={`${styles.stepCard} h-full rounded-lg p-6`}>
                <h3 className="text-lg font-semibold">What we bring</h3>
                <ul className="mt-3 flex list-none flex-col gap-2 text-sm leading-relaxed text-base-content/75">
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
                    Paid transitional work and training that leads to certifications
                  </li>
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
                    A coordinator and an on-site supervisor who want you to succeed
                  </li>
                  <li className="flex gap-2">
                    <Paw className="mt-0.5 size-4 shrink-0 text-secondary/60" />
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
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-20">
            <Paw className="size-8 text-teal-300/80" />
            <h2
              id="closing-heading"
              className={`${styles.display} max-w-xl text-3xl font-semibold sm:text-4xl`}
            >
              Ready when you are.
            </h2>
            <p className="max-w-prose text-base leading-relaxed text-slate-200">
              Creating your account is the first step — the application itself is plain
              questions, at your pace, saved as you go.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md border border-teal-200/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
            >
              Create Your Account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
