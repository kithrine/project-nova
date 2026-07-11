import { Fraunces } from "next/font/google";

import { PublicFooter, PublicHeader } from "@/components/layout/public-header";

/**
 * Public experience layout (Story 2.1). Loads the display face used only on
 * public pages — Fraunces, a warm editorial serif — alongside the app-wide
 * Inter body (docs/ux/visual-design-reference.md permits more expressive
 * treatment on public pages). Exposes it as --font-display for CSS.
 */
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} flex min-h-full flex-1 flex-col`}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
