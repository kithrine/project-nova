"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper (Story 2.1; reversible since the visual pass
 * 2026-07-18). Toggles data-visible as the element enters and leaves the
 * viewport, so reveals replay in BOTH scroll directions; the CSS module
 * decides what that means, and prefers-reduced-motion users simply see
 * content immediately (the reveal styles only exist inside a
 * no-preference media query).
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts false on server AND client (identical SSR markup — no hydration
  // mismatch). The CSS only hides reveal content when JS is running
  // (html.js), so no-JS visitors always see everything.
  const [visible, setVisible] = useState(false);
  // Which viewport edge the element last exited through. The hidden
  // transform must always push AWAY from the viewport — re-hiding a
  // top-exited element at +22px would move it back toward the boundary
  // and oscillate the observer.
  const [exitEdge, setExitEdge] = useState<"top" | "bottom">("bottom");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer available: reveal on the next frame.
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
          } else {
            setExitEdge(
              entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
                ? "top"
                : "bottom",
            );
            setVisible(false);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-visible={visible || undefined}
      data-exit={exitEdge}
      style={delayMs ? ({ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
