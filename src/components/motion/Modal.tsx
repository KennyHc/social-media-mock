"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { duration, ease, enter, exit, exitT, scale, spring } from "@/motion/tokens";
import { useDialogBehavior, useIsClient } from "./a11y";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; rendered as the visible heading (aria-labelledby). */
  title: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Centered dialog. Scale .96 to 1 plus fade (spring.snappy); exit is a faster
 * ease-in fade. role="dialog", aria-modal, focus trap and restore, Escape
 * closes, body scroll locked. Fade only under reduced motion.
 */
export function Modal(props: DialogProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>{props.open && <ModalLayer key="modal" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function ModalLayer({ onOpenChange, title, children, className }: DialogProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const present = useDialogBehavior(ref, () => onOpenChange(false));
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center p-4",
        !present && "pointer-events-none",
      )}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundColor: "var(--backdrop)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: duration.short } }}
        exit={{ opacity: 0, transition: { duration: exit(duration.short), ease: ease.in } }}
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-fg shadow-xl outline-none",
          className,
        )}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: scale.modalFrom }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={reduced ? { opacity: 0, transition: exitT } : { opacity: 0, scale: scale.modalFrom, transition: exitT }}
        transition={{ opacity: enter, scale: spring.snappy }}
      >
        <h2 id={titleId} className="mb-3 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </motion.div>
    </div>
  );
}
