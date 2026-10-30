"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { duration, enter, exitT, scale, spring } from "@/motion/tokens";

export type CheckmarkDrawProps = {
  /** Pixel size (width and height). */
  size?: number;
  /** Any CSS color. Fills the circle (or strokes the check when `bare`). */
  color?: string;
  /** Draw only the check, with no filled circle. Inherits `currentColor` by default. */
  bare?: boolean;
  className?: string;
};

/**
 * A circle pops in (spring.bouncy) then the check draws via pathLength 0 to 1
 * (duration.short, ease.out). Fades out on exit; fades only under reduced motion.
 */
export function CheckmarkDraw({
  size = 24,
  color,
  bare = false,
  className,
}: CheckmarkDrawProps) {
  const reduced = usePrefersReducedMotion();
  const fill = color ?? (bare ? "currentColor" : "var(--success)");
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: scale.popFrom }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: exitT }}
      transition={{ opacity: enter, scale: spring.bouncy }}
    >
      {!bare && <circle cx="12" cy="12" r="12" fill={fill} />}
      <motion.path
        d="M7 12.5l3.2 3.2L17 9"
        stroke={bare ? fill : "var(--accent-fg)"}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...enter, delay: reduced ? 0 : duration.instant }}
      />
    </motion.svg>
  );
}
