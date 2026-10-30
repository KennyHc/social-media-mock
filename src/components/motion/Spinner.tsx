"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { ease, timing } from "@/motion/tokens";

export type SpinnerProps = {
  size?: number;
  /** Color via currentColor, e.g. "text-fg-muted". */
  className?: string;
};

/** Indeterminate spinner: a rotating arc (opacity pulse under reduced motion). Decorative. */
export function Spinner({ size = 18, className }: SpinnerProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn(className)}
      animate={reduced ? { opacity: [1, 0.4, 1] } : { rotate: 360 }}
      transition={{ duration: timing.spin, ease: ease.linear, repeat: Infinity }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  );
}
