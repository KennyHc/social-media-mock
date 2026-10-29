"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { distance, enter, exitT, gesture, layout, scale, spring } from "@/motion/tokens";
import { CheckmarkDraw } from "./CheckmarkDraw";
import { getServerToasts, getToasts, subscribeToasts, toast, type ToastItem } from "./toast";

/**
 * Renders the toast stack (max 3). Errors are role="alert", others role="status". Toasts spring in
 * from the top, swipe horizontally to dismiss, auto-exit after 4 s (paused on
 * hover or drag) and re-flow with layout animation.
 */
export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const reduced = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const paused = hovered || dragging;
  const remaining = useRef(item.duration);

  useEffect(() => {
    if (paused || item.duration <= 0) return;
    const started = performance.now();
    const id = setTimeout(() => toast.dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [paused, item.id, item.duration]);

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    setDragging(false);
    if (
      Math.abs(info.offset.x) > gesture.swipeOffset ||
      Math.abs(info.velocity.x) > gesture.dismissVelocity
    ) {
      toast.dismiss(item.id);
    }
  };

  return (
    <motion.div
      layout
      // Role on the item only (no live container), so each toast is announced once.
      role={item.kind === "error" ? "alert" : "status"}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragStart={() => setDragging(true)}
      onDragEnd={onDragEnd}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -distance.toastY }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0, transition: exitT }
          : { opacity: 0, scale: scale.itemExit, transition: exitT }
      }
      transition={{ opacity: enter, y: spring.snappy, layout }}
      className="pointer-events-auto flex w-full max-w-sm touch-pan-y items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-fg shadow-lg"
    >
      <ToastIcon kind={item.kind} />
      <span className="min-w-0 flex-1">{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(item.id)}
        className="-m-1 grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-2"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </motion.div>
  );
}

function ToastIcon({ kind }: { kind: ToastItem["kind"] }) {
  if (kind === "success") return <CheckmarkDraw size={20} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-accent-fg",
        kind === "error" ? "bg-danger" : "bg-accent-3",
      )}
    >
      {kind === "error" ? "!" : "i"}
    </span>
  );
}
