"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { CheckmarkDraw } from "./CheckmarkDraw";
import { Shake } from "./Shake";
import { enter, spring, timing } from "@/motion/tokens";

export type ProgressRingProps = {
  /** 0 to 1. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Completes the ring, then crossfades to a drawn checkmark. */
  done?: boolean;
  /** Danger color plus a shake. */
  error?: boolean;
  className?: string;
  /** Accessible label for the progressbar. */
  label?: string;
};

/**
 * Circular progress. The arc follows `progress` on a spring (SVG pathLength,
 * never width). On `done` the ring completes, then crossfades into CheckmarkDraw.
 */
export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  done = false,
  error = false,
  className,
  label = "Progress",
}: ProgressRingProps) {
  const [settled, setSettled] = useState(false);
  if (!done && settled) setSettled(false);

  useEffect(() => {
    if (!done || error) return;
    const id = setTimeout(() => setSettled(true), timing.ringSettleMs);
    return () => clearTimeout(id);
  }, [done, error]);

  const showCheck = done && !error && settled;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  return (
    <Shake
      trigger={error ? "error" : null}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((done ? 1 : clamped) * 100)}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        className="-rotate-90"
        animate={{ opacity: showCheck ? 0 : 1 }}
        transition={enter}
      >
        <circle cx={c} cy={c} r={r} stroke="var(--border)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          stroke={error ? "var(--danger)" : "var(--accent)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: done ? 1 : clamped }}
          transition={spring.gentle}
        />
      </motion.svg>
      <AnimatePresence>
        {showCheck && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <CheckmarkDraw size={size} />
          </span>
        )}
      </AnimatePresence>
    </Shake>
  );
}
