"use client";

import {
  motion,
  useAnimationControls,
  type HTMLMotionProps,
} from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { distance, duration, ease, timing } from "@/motion/tokens";

/**
 * Returns `controls` (pass as `animate` to a motion element) and `shake()`.
 * Three +/- cycles over 300 ms; a brief opacity dip under reduced motion.
 * Calling again mid-shake restarts from the current position (interruptible).
 */
export function useShake(): { controls: ReturnType<typeof useAnimationControls>; shake: () => Promise<void> } {
  const controls = useAnimationControls();
  const reduced = usePrefersReducedMotion();
  const shake = useCallback(async () => {
    const s = distance.shake;
    if (reduced) {
      await controls.start({ opacity: [1, 0.5, 1], transition: { duration: duration.short } });
    } else {
      await controls.start({
        x: [0, s, -s, s, -s, s, -s, 0],
        transition: { duration: timing.shake, ease: ease.inOut },
      });
    }
  }, [controls, reduced]);
  return { controls, shake };
}

export type ShakeProps = Omit<HTMLMotionProps<"div">, "animate"> & {
  /** Shakes whenever this value changes to a truthy value. */
  trigger?: unknown;
  children?: ReactNode;
};

/** Wrapper that shakes its children when `trigger` changes (falsy values do not shake). */
export function Shake({ trigger, children, ...props }: ShakeProps) {
  const { controls, shake } = useShake();
  const last = useRef(trigger);
  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    if (trigger) void shake();
  }, [trigger, shake]);
  return (
    <motion.div animate={controls} {...props}>
      {children}
    </motion.div>
  );
}
