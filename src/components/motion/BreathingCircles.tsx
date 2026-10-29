"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { distance, ease, opacity, scale, timing } from "@/motion/tokens";

export type BreathingCirclesProps = {
  size?: number;
  className?: string;
};

/** Token values handed to the CSS keyframes in globals.css (`@keyframes breathe`). */
const vars = {
  "--breathe-duration": `${timing.breathe}s`,
  "--breathe-ease": `cubic-bezier(${ease.inOut.join(",")})`,
  "--breathe-scale": scale.breathe,
  "--breathe-x": `${distance.breatheX}px`,
  "--breathe-lo": opacity.breatheLow,
} as CSSProperties;

/**
 * Empty-state illustration: the Logo's two circles breathing. Pure CSS keyframes
 * (transform and opacity, compositor-friendly, no JS per frame): scale 1 to 1.04,
 * x -2 to 2 px (opposite directions) and opacity .85 to 1 over 3 s, ease.inOut,
 * alternating. The second circle is a full cycle ahead (negative delay) so the two
 * are in counter-phase. Static under reduced motion (CSS media query); paused via
 * `animation-play-state` while the tab is hidden or the element is offscreen, which
 * resumes from the current frame.
 */
export function BreathingCircles({ size = 96, className }: BreathingCirclesProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = true;
    let tabVisible = !document.hidden;
    const sync = () => {
      el.dataset.paused = String(!(onScreen && tabVisible));
    };
    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", onVis);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      style={vars}
      className={cn("breathing pointer-events-none shrink-0", className)}
    >
      <circle className="breathing-circle" cx="38" cy="48" r="20" fill="var(--accent)" />
      <circle
        className="breathing-circle breathing-circle-b"
        cx="58"
        cy="48"
        r="20"
        fill="var(--accent-3)"
      />
    </svg>
  );
}
