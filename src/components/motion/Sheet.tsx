"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useId, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { duration, ease, enter, exit, exitT, gesture, spring } from "@/motion/tokens";
import { useDialogBehavior, useIsClient, useMediaQuery } from "./a11y";
import { Modal, type DialogProps } from "./Modal";

export type SheetProps = DialogProps & {
  /** Optional fixed height (CSS length, e.g. "60dvh"). Defaults to content height. */
  height?: CSSProperties["height"];
};

/**
 * Bottom sheet. Opens y 100% to 0 on spring.sheet with a fading backdrop; the
 * whole sheet drags on y and dismisses past 30% of its height or 500 px/s,
 * otherwise snaps back on spring.sheet. Backdrop opacity tracks the drag.
 * Exit is ease-in at exit(duration.medium). From 640px up it renders as a Modal.
 */
export function Sheet(props: SheetProps) {
  const isClient = useIsClient();
  const desktop = useMediaQuery("(min-width: 640px)");
  if (!isClient) return null;
  if (desktop) return <Modal {...props} />;
  return createPortal(
    <AnimatePresence>{props.open && <SheetLayer key="sheet" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function SheetLayer({ onOpenChange, title, children, className, height }: SheetProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const present = useDialogBehavior(ref, () => onOpenChange(false));
  const y = useMotionValue(0);
  const progress = useMotionValue(0);
  const dim = useTransform(progress, [0, 1], [1, 0]);

  const onDrag = (_: PointerEvent, info: PanInfo) => {
    const h = ref.current?.offsetHeight ?? 1;
    progress.set(Math.min(Math.max(info.offset.y / h, 0), 1));
  };
  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const h = ref.current?.offsetHeight ?? 1;
    if (info.offset.y > h * gesture.sheetFraction || info.velocity.y > gesture.dismissVelocity) {
      onOpenChange(false);
      return;
    }
    animate(y, 0, spring.sheet);
    animate(progress, 0, spring.sheet);
  };

  return (
    <div className={cn("fixed inset-0 z-50", !present && "pointer-events-none")}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: duration.short } }}
        exit={{ opacity: 0, transition: { duration: exit(duration.medium), ease: ease.in } }}
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--backdrop)", opacity: dim }}
        />
      </motion.div>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.6 }}
        dragMomentum={false}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        style={{ y, height }}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] text-fg shadow-xl outline-none",
          className,
        )}
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1, transition: enter } : { y: 0, transition: spring.sheet }}
        exit={
          reduced
            ? { opacity: 0, transition: exitT }
            : { y: "100%", transition: { duration: exit(duration.medium), ease: ease.in } }
        }
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="px-5 pt-3">
          <h2 id={titleId} className="mb-3 text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
