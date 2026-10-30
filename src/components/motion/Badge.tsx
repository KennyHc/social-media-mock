"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import { ease, exit, duration, scale, spring } from "@/motion/tokens";
import { reduceVariants, usePrefersReducedMotion } from "@/motion/reduced-motion";
import { AnimatedNumber } from "./AnimatedNumber";

const variants: Variants = {
  hidden: { opacity: 0, scale: scale.popFrom },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
  gone: {
    opacity: 0,
    scale: scale.popFrom,
    transition: { duration: exit(duration.short), ease: ease.in },
  },
};
const reducedVariants = reduceVariants(variants);

export type BadgeProps = {
  count: number;
  /** Counts above this show as "max+". */
  max?: number;
  className?: string;
  /** Unused: the badge is a purely visual `aria-hidden` mark; its parent link carries the accessible name. */
  label?: string;
};

/**
 * Notification count pill. Pops in (scale .8 to 1 + opacity, spring.bouncy),
 * shrinks and fades out (ease.in, exit(duration.short)); the number rolls via
 * AnimatedNumber. Renders nothing at 0. Opacity only under reduced motion
 * (MotionConfig reducedMotion="user" strips the scale).
 */
export function Badge({ count, max = 9, className }: BadgeProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key="badge"
          aria-hidden="true"
          variants={reduced ? reducedVariants : variants}
          initial="hidden"
          animate="show"
          exit="gone"
          className={cn(
            "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold tabular-nums leading-none text-accent-fg",
            className,
          )}
        >
          <AnimatedNumber value={count} format={(n) => (n > max ? `${max}+` : String(n))} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
