import { Caveat, Lora } from "next/font/google";

import { PublicFooter, PublicHeader } from "@/components/layout/public-header";

/**
 * Public experience layout (Story 2.1). Loads the faces used only on
 * public pages — Lora, a warm bookish serif with clean letterforms
 * (swapped from Fraunces 2026-07-18; its wonky f/j hooks read wrong at
 * display sizes), and Caveat, the pen-drawn script for accent words —
 * alongside the app-wide Inter body (docs/ux/visual-design-reference.md
 * permits more expressive treatment on public pages). Lora loads the
 * italic face too — the How It Works accent phrase depends on it.
 * Exposed as --font-display and --font-script for CSS.
 */
const lora = Lora({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-script",
  subsets: ["latin"],
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${lora.variable} ${caveat.variable} flex min-h-full flex-1 flex-col`}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
