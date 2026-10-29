"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckmarkDraw } from "@/components/motion";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import type { Availability } from "@/features/onboarding/hooks";
import { ease, enter, exitT, timing } from "@/motion/tokens";

function Spinner() {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="text-fg-muted"
      animate={reduced ? { opacity: [1, 0.4, 1] } : { rotate: 360 }}
      transition={{ duration: timing.spin, ease: ease.linear, repeat: Infinity }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-danger">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

type Kind = "checking" | "available" | "bad" | null;

function kindOf(status: Availability["status"], serverError: boolean): Kind {
  if (serverError) return "bad";
  if (status === "checking") return "checking";
  if (status === "available") return "available";
  if (status === "invalid" || status === "taken" || status === "error") return "bad";
  return null;
}

/** Fixed 24px slot (reserved by Input's trailing wrapper) that crossfades between states. */
export function AvailabilityIndicator({
  status,
  serverError = false,
}: {
  status: Availability["status"];
  serverError?: boolean;
}) {
  const kind = kindOf(status, serverError);
  return (
    <span className="relative grid h-6 w-6 place-items-center" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        {kind && (
          <motion.span
            key={kind}
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: enter }}
            exit={{ opacity: 0, transition: exitT }}
          >
            {kind === "checking" && <Spinner />}
            {kind === "available" && <CheckmarkDraw size={20} color="var(--success)" />}
            {kind === "bad" && <XIcon />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
