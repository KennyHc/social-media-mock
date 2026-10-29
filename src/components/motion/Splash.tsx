"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { duration, ease, enter, scale, spring, timing } from "@/motion/tokens";
import { useIsClient } from "./a11y";

const KEY = "splash-shown";

export type SplashProps = {
  /** Ignore the once-per-session flag (used by the dev playground replay). */
  force?: boolean;
  onDone?: () => void;
};

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Branded launch animation, once per session. Renders nothing on the server.
 * The logo scales in (spring.gentle) while an accent ring strokes in, then the
 * overlay lifts 8px and fades out (ease-in). Never blocks input; under reduced
 * motion it is a plain 150 ms fade. Mount once at the app root next to the content.
 */
export function Splash(props: SplashProps) {
  const isClient = useIsClient();
  return isClient ? <SplashInner {...props} /> : null;
}

function SplashInner({ force, onDone }: SplashProps) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(() => force || !alreadyShown());

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Storage unavailable: the splash may replay, which is harmless.
    }
    const id = setTimeout(
      () => setVisible(false),
      reduced ? timing.reducedFade * 1000 : timing.splashHoldMs,
    );
    return () => clearTimeout(id);
  }, [visible, reduced]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-bg"
          initial={{ opacity: reduced ? 0 : 1 }}
          animate={{ opacity: 1, transition: { duration: timing.reducedFade } }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: timing.reducedFade } }
              : { opacity: 0, y: -8, transition: { duration: duration.micro, ease: ease.in } }
          }
        >
          <motion.svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            fill="none"
            initial={reduced ? false : { opacity: 0, scale: scale.popFrom }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ opacity: enter, scale: spring.gentle }}
          >
            <circle cx="38" cy="48" r="20" fill="var(--accent)" fillOpacity="0.9" />
            <circle cx="58" cy="48" r="20" fill="var(--accent-3)" fillOpacity="0.8" />
            <motion.circle
              cx="48"
              cy="48"
              r="44"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              className="-rotate-90 origin-center"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: duration.long, ease: ease.out }}
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
