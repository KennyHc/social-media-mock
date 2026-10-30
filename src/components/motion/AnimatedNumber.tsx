"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { distance, enter, exitT } from "@/motion/tokens";
import { reduceVariants, usePrefersReducedMotion } from "@/motion/reduced-motion";

const variants: Variants = {
  enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? distance.roll : `-${distance.roll}` }),
  center: { opacity: 1, y: 0, transition: enter },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? `-${distance.roll}` : distance.roll,
    transition: exitT,
  }),
};
const reducedVariants = reduceVariants(variants);

const defaultFormat = (n: number) => n.toLocaleString("en-US");

export type AnimatedNumberProps = {
  value: number;
  /** Text formatter. Defaults to en-US grouping. */
  format?: (value: number) => string;
  className?: string;
  /** Announce changes to screen readers (aria-live="polite"). */
  live?: boolean;
};

/**
 * Rolls only the changed characters: increases roll up, decreases roll down
 * (duration.short, ease.out in; faster out). Tabular figures keep width stable.
 */
export function AnimatedNumber({ value, format = defaultFormat, className, live }: AnimatedNumberProps) {
  const reduced = usePrefersReducedMotion();
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState(1);
  if (value !== prev) {
    setPrev(value);
    setDir(value > prev ? 1 : -1);
  }
  const text = format(value);
  const chars = Array.from(text);
  const v = reduced ? reducedVariants : variants;
  return (
    <span
      className={cn("inline-flex whitespace-pre tabular-nums", className)}
      aria-live={live ? "polite" : undefined}
      aria-atomic={live ? true : undefined}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((ch, i) => (
          <span key={chars.length - i} className="relative inline-block">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.span
                key={ch}
                custom={dir}
                variants={v}
                initial="enter"
                animate="center"
                exit="exit"
                className="inline-block"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </span>
  );
}
