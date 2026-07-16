import { Caveat, Fraunces } from "next/font/google";

import { PublicFooter, PublicHeader } from "@/components/layout/public-header";

/**
 * Public experience layout (Story 2.1). Loads the faces used only on
 * public pages — Fraunces, a warm editorial serif, and Caveat, the
 * pen-drawn script for accent words — alongside the app-wide Inter body
 * (docs/ux/visual-design-reference.md permits more expressive treatment
 * on public pages). Exposed as --font-display and --font-script for CSS.
 */
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const caveat = Caveat({
  variable: "--font-script",
  subsets: ["latin"],
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${caveat.variable} flex min-h-full flex-1 flex-col`}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
