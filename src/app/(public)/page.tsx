import Image from "next/image";
import Link from "next/link";

import { BreathingDots } from "@/components/decor/breathing-dots";
import { NavIcon } from "@/components/layout/nav-icons";
import { NovaLogo } from "@/components/layout/nova-logo";

import { Reveal } from "./how-it-works/reveal";
import styles from "./home.module.css";

/**
 * Homepage (brand refresh 2026-07-15) — the mockup-driven marketing
 * surface: warm cream, deep teal, chartreuse accents, organic decoration,
 * and an illustrative product card. Everything decorative is aria-hidden
 * inline SVG/CSS; the only links are the two real CTAs plus the header's.
 * The h1's accessible name is asserted by tests/e2e/smoke.spec.ts.
 */

/** Organic blob — decorative only. */
function Blob({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" fill="currentColor" className={className}>
      <path d="M165 41c18 21 26 51 18 76s-32 45-59 53-57 4-77-13S17 111 22 84 46 33 71 22s76-2 94 19Z" />
    </svg>
  );
}

/** Hand-drawn underline flourish for the script word — decorative only. */
function UnderlineFlourish({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      preserveAspectRatio="none"
      className={className}
    >
      {/* pathLength=1 normalizes both strokes so the CSS marker-draw
          (dasharray/dashoffset 1 -> 0) needs no measured lengths. */}
      <path d="M6 15C48 8 100 6 214 12" pathLength={1} />
      <path d="M28 20c56-7 118-8 168-5" strokeWidth="4" opacity="0.65" pathLength={1} />
    </svg>
  );
}

/** Paw motif (shared visual signature with how-it-works) — decorative only. */
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
 * Value-card icon quartet (styling round 4) — Lucide-derived paths
 * (ISC license) inlined as local components: dependency-free, decorative
 * (aria-hidden), currentColor ink so each card's tone class colors them
 * (see .valueCard* vars in home.module.css).
 */

/** Hand cradling a heart — Participant-Centered (Lucide "hand-heart"). */
function HandHeart({ className }: { className?: string }) {
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
      <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
      <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 15 6 6" />
      <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z" />
    </svg>
  );
}

/** Paw print — Shelter Partnerships (Lucide "paw-print"). */
function PawPrint({ className }: { className?: string }) {
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
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </svg>
  );
}

/** Connected step nodes — Workflow-Driven (Lucide "workflow"). */
function WorkflowNodes({ className }: { className?: string }) {
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
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  );
}

/** Rising line chart — Data That Drives Change (Lucide "chart-line"). */
function ChartLine({ className }: { className?: string }) {
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
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

/** Full-width organic wave divider into the closing band — decorative. */
function Wave({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      fill="currentColor"
      className={className}
    >
      <path d="M0 80V44C120 16 260 4 420 14s280 34 440 36 320-22 440-34c60-6 105-6 140-2v66Z" />
    </svg>
  );
}

/*
 * Illustrative product card — a stylized, fictional glimpse of the
 * coordinator dashboard (pure CSS/HTML, aria-hidden, nothing focusable).
 * COMMENTED OUT 2026-07-18: swapped for the photographic hero image
 * (public/images/nova-homepage-hero.png) at Kit's request — kept intact
 * here (with its .dash* styles in home.module.css) for potential return.
 *
function DashboardIllustration() {
  return (
    <div className={`${styles.heroArt} ${styles.heroArtRise}`} aria-hidden="true">
      <Blob className={styles.dashBlob} />
      <div className={styles.dashCardBack} />
      <div className={styles.dashCard}>
        <div className="flex items-center gap-2.5">
          <span className={styles.dashAvatar}>JL</span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Welcome back, Jordan</span>
            <span className="text-base-content/60">Program Coordinator</span>
          </div>
          <span className={`${styles.dashChip} ml-auto`}>
            <NovaLogo className="size-3" />3 new applications
          </span>
        </div>

        <div className={styles.dashStats}>
          <div className={styles.dashStat}>
            <span className={styles.dashStatValue}>12</span>
            <span className="text-base-content/60">Active placements</span>
          </div>
          <div className={styles.dashStat}>
            <span className={styles.dashStatValue}>96</span>
            <span className="text-base-content/60">Hours this week</span>
          </div>
          <div className={styles.dashStat}>
            <span className={styles.dashStatValue}>4</span>
            <span className="text-base-content/60">Matches in review</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">Onboarding</span>
            <span className="text-base-content/60">8 of 10 tasks</span>
          </div>
          <span className={styles.dashBar}>
            <span className={styles.dashBarFill} style={{ width: "80%" }} />
          </span>
          <div className="flex items-center justify-between">
            <span className="font-medium">Training</span>
            <span className="text-base-content/60">3 of 5 modules</span>
          </div>
          <span className={styles.dashBar}>
            <span className={styles.dashBarFill} style={{ width: "60%" }} />
          </span>
        </div>
      </div>

      <div className={styles.dashFloatChip}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Timesheet approved
      </div>
    </div>
  );
}
*/

const VALUE_PROPS = [
  {
    title: "Participant-Centered",
    body: "Track progress, celebrate growth, and remove barriers on the way to meaningful employment.",
    icon: <HandHeart className="size-6" />,
    tone: "brightTeal",
  },
  {
    title: "Shelter Partnerships",
    body: "Streamline placements and stay in step with the shelters you rely on.",
    icon: <PawPrint className="size-6" />,
    tone: "chartreuse",
  },
  {
    title: "Workflow-Driven",
    body: "Every step has a next step — tasks, approvals, and records that keep the program moving forward.",
    icon: <WorkflowNodes className="size-6" />,
    tone: "darkTeal",
  },
  {
    title: "Data That Drives Change",
    body: "Measure outcomes, prove impact, and support the funding your community deserves.",
    icon: <ChartLine className="size-6" />,
    tone: "yellow",
  },
] as const;

/* Tone class goes on the CARD (styling round 4): each sets the icon ink
   plus a super-low-opacity wash of that same color for the card
   background and icon circle (CSS vars in home.module.css). Explicit
   per-card classes — never structural selectors (the round-3 lesson). */
const VALUE_CARD_TONE = {
  brightTeal: styles.valueCardBrightTeal,
  chartreuse: styles.valueCardChartreuse,
  darkTeal: styles.valueCardDarkTeal,
  yellow: styles.valueCardYellow,
} as const;

const TRUST_CATEGORIES = [
  { label: "Animal Shelters", icon: <Paw className={`size-5 ${styles.trustIcon}`} /> },
  {
    label: "Workforce Boards",
    icon: <NavIcon name="briefcase" className={`size-5 ${styles.trustIcon}`} />,
  },
  {
    label: "Reentry Programs",
    icon: <NavIcon name="users" className={`size-5 ${styles.trustIcon}`} />,
  },
  {
    label: "Community Nonprofits",
    icon: <NavIcon name="building" className={`size-5 ${styles.trustIcon}`} />,
  },
] as const;

export default function HomePage() {
  return (
    <main id="main-content" className={`${styles.page} flex flex-1 flex-col`}>
      <BreathingDots anchor="top-right" className={styles.heroDots} />
      <div className={styles.content}>
        {/* --- Hero ------------------------------------------------------ */}
        <section className="relative mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-14 lg:pt-20 lg:pb-24">
          <div className={styles.heroGrid}>
            <div className={`${styles.heroReveal} flex flex-col items-start gap-5 sm:gap-6`}>
              <p className={styles.eyebrow}>
                <NovaLogo className="size-3.5" />
                Paid transitional work at animal shelters
              </p>
              <h1 className={`${styles.display} ${styles.heroTitle} text-balance`}>
                Stronger futures start with{" "}
                <span className={styles.scriptWord}>
                  {/* Inner span: the write-on wipe clips THIS box only, so
                      the accessible name ("…opportunity.") never changes. */}
                  <span className={styles.scriptWordText}>opportunity.</span>
                  <UnderlineFlourish className={styles.scriptUnderline} />
                </span>
              </h1>
              <p className="max-w-prose text-lg leading-relaxed text-base-content/80">
                Project Nova helps people returning from incarceration enter paid,
                meaningful transitional work at animal shelters — building skills,
                credentials, and a path toward sustainable employment.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/how-it-works"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-content transition-[color,background-color,box-shadow,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:shadow-none"
                >
                  See How It Works
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
                </a>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-[color,background-color,border-color,box-shadow,transform] hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:shadow-none"
                >
                  Start Your Application
                </Link>
              </div>
            </div>

            {/* Photographic hero (2026-07-18) — replaces <DashboardIllustration />,
                which is commented out above for potential return. Decorative:
                empty alt + aria-hidden wrapper, same stance as the mockup. */}
            <div className={`${styles.heroPhoto} ${styles.heroArtRise}`} aria-hidden="true">
              <Image
                src="/images/nova-homepage-hero.png"
                alt=""
                width={1535}
                height={1024}
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
                className={styles.heroImage}
              />
            </div>
          </div>
        </section>

        {/* --- Trust strip ---------------------------------------------- */}
        <section aria-labelledby="trust-heading" className={styles.trust}>
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:px-6">
            <h2
              id="trust-heading"
              className="text-center text-sm font-semibold tracking-wide text-primary"
            >
              Built for shelters and workforce programs making an impact
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
              {TRUST_CATEGORIES.map((category) => (
                <li key={category.label} className={styles.trustItem}>
                  {category.icon}
                  {category.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --- Value props ------------------------------------------------ */}
        <section
          aria-labelledby="value-heading"
          className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20"
        >
          <Blob className={styles.blobChartreuse} />
          {/* Photographic leaf line-art (round 4, replacing the hand-drawn
              sprig): anchored to the section's bottom-right, behind the
              cards — decorative, faint, non-interactive. */}
          <Image
            src="/images/teal-leaves.png"
            alt=""
            width={1536}
            height={1024}
            aria-hidden="true"
            className={styles.valueLeaves}
          />
          <div className="relative flex flex-col gap-10">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className={`${styles.display} text-3xl font-semibold sm:text-4xl`} id="value-heading">
                Why programs choose Project Nova
              </h2>
              <p className="text-base-content/70">
                One place to run a transitional-employment program with care — from
                first application to lasting employment.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {VALUE_PROPS.map((prop, index) => (
                <Reveal
                  key={prop.title}
                  className={styles.reveal}
                  delayMs={index * 90}
                  from={index < 2 ? "left" : "right"}
                >
                  <div className={`${styles.valueCard} ${VALUE_CARD_TONE[prop.tone]}`}>
                    <span className={styles.valueIcon}>{prop.icon}</span>
                    <h3 className="text-base font-semibold">{prop.title}</h3>
                    <p className="text-sm leading-relaxed text-base-content/70">{prop.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --- Closing band ---------------------------------------------- */}
        <div className={styles.waveWrap}>
          <Wave className="h-10 w-full sm:h-14" />
        </div>
        <section aria-label="Our mission" className={styles.band}>
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 pt-6 pb-16 text-center sm:px-6">
            {/* The full brand lockup (styling round 2) — transparent PNG,
                decorative; the tagline below carries the words. */}
            <Image
              src="/images/nova-logo.png"
              alt=""
              width={1254}
              height={1254}
              className={styles.bandLogo}
            />
            <p className={styles.bandScript}>
              Building pathways. Strengthening communities. Changing lives.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
