"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { distance, enter, exitT } from "@/motion/tokens";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";

const tags = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  ul: motion.ul,
  p: motion.p,
  span: motion.span,
} as const;

export type FadeInProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "exit" | "transition"
> & {
  /** Seconds to wait before the entrance. */
  delay?: number;
  /** Element to render. Defaults to div. */
  as?: keyof typeof tags;
};

/**
 * Fades in while rising `distance.enterY` px (enter preset); exits reversed and
 * faster (exitT). Wrap in AnimatePresence to get the exit. Opacity-only under reduced motion.
 */
export function FadeIn({ delay = 0, as = "div", ...props }: FadeInProps) {
  const reduced = usePrefersReducedMotion();
  const Comp = tags[as] as typeof motion.div;
  const off = reduced ? { opacity: 0 } : { opacity: 0, y: distance.enterY };
  const on = reduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  return (
    <Comp
      initial={off}
      animate={{ ...on, transition: { ...enter, delay } }}
      exit={{ ...off, transition: exitT }}
      {...props}
    />
  );
}
