"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckmarkDraw, Spinner } from "@/components/motion";
import type { Availability } from "@/features/onboarding/hooks";
import { enter, exitT } from "@/motion/tokens";

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
            {kind === "checking" && <Spinner className="text-fg-muted" />}
            {kind === "available" && <CheckmarkDraw size={20} color="var(--success)" />}
            {kind === "bad" && <XIcon />}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
