"use client";

import { motion, useAnimationControls } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { distance, ease, opacity, scale, timing } from "@/motion/tokens";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";

export type BreathingCirclesProps = {
  size?: number;
  className?: string;
};

const loop = { duration: timing.breathe, ease: ease.inOut, repeat: Infinity, repeatType: "mirror" } as const;
const lo = { scale: 1, x: -distance.breatheX, opacity: opacity.breatheLow };
const hi = { scale: scale.breathe, x: distance.breatheX, opacity: 1 };

/**
 * Empty-state illustration: the Logo's two circles breathing. Each circle goes
 * scale 1 to 1.04, x -2 to 2 px (opposite directions) and opacity .85 to 1 over
 * 3 s (ease.inOut, mirrored loop); the circles are in counter-phase. Static under
 * reduced motion; paused while the tab is hidden or the element is offscreen.
 */
export function BreathingCircles({ size = 96, className }: BreathingCirclesProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const a = useAnimationControls();
  const b = useAnimationControls();

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    let onScreen = true;
    let tabVisible = !document.hidden;
    let running = false;
    const sync = () => {
      const want = onScreen && tabVisible;
      if (want === running) return;
      running = want;
      if (want) {
        void a.start({ scale: [lo.scale, hi.scale], x: [lo.x, hi.x], opacity: [lo.opacity, hi.opacity], transition: loop });
        void b.start({ scale: [hi.scale, lo.scale], x: [hi.x, lo.x], opacity: [hi.opacity, lo.opacity], transition: loop });
      } else {
        a.stop();
        b.stop();
      }
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
      a.stop();
      b.stop();
    };
  }, [reduced, a, b]);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className={cn("pointer-events-none shrink-0", className)}
    >
      <motion.circle cx="38" cy="48" r="20" fill="var(--accent)" initial={lo} animate={a} />
      <motion.circle cx="58" cy="48" r="20" fill="var(--accent-3)" initial={hi} animate={b} />
    </svg>
  );
}
