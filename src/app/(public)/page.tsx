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

/** Leaf sprig — decorative only. */
function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M30 76C28 52 30 28 38 8" />
      <path d="M34 22c-8-2-14-8-16-16 8 0 15 6 16 16Z" fill="currentColor" stroke="none" />
      <path d="M35 40c-9 1-17-3-21-11 9-2 17 3 21 11Z" fill="currentColor" stroke="none" />
      <path d="M32 56c-8 3-17 1-23-6 8-4 17-1 23 6Z" fill="currentColor" stroke="none" />
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
      <path d="M6 15C48 8 100 6 214 12" />
      <path d="M28 20c56-7 118-8 168-5" strokeWidth="4" opacity="0.65" />
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
    icon: <NavIcon name="user" className="size-6" />,
  },
  {
    title: "Shelter Partnerships",
    body: "Streamline placements and stay in step with the shelters you rely on.",
    icon: <Paw className="size-6" />,
  },
  {
    title: "Workflow-Driven",
    body: "Every step has a next step — tasks, approvals, and records that keep the program moving forward.",
    icon: <NavIcon name="clipboard" className="size-6" />,
  },
  {
    title: "Data That Drives Change",
    body: "Measure outcomes, prove impact, and support the funding your community deserves.",
    icon: <NavIcon name="chart" className="size-6" />,
  },
] as const;

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
        <section className="relative mx-auto w-full max-w-6xl px-4 pt-14 pb-16 sm:px-6 lg:pt-20 lg:pb-24">
          <div className={styles.heroGrid}>
            <div className={`${styles.heroReveal} flex flex-col items-start gap-6`}>
              <p className={styles.eyebrow}>
                <NovaLogo className="size-3.5" />
                Workforce impact. Community change.
              </p>
              <h1 className={`${styles.display} ${styles.heroTitle} text-balance`}>
                Stronger futures start with{" "}
                <span className={styles.scriptWord}>
                  opportunity.
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
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-content transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                    className="size-4"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                sizes="(min-width: 1024px) 560px, 100vw"
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
          <LeafSprig className={`${styles.leafSprig} ${styles.leafSprigBottom}`} />
          <div className="flex flex-col gap-10">
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
                <Reveal key={prop.title} className={styles.reveal} delayMs={index * 90}>
                  <div className={styles.valueCard}>
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
            <NovaLogo className="size-8 text-accent/80" />
            <p className={styles.bandScript}>
              Building pathways. Strengthening communities. Changing lives.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
