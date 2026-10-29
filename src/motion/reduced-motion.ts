"use client";

import { useSyncExternalStore } from "react";
import type { Variants } from "motion/react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * True when the user prefers reduced motion. Hydration-safe: false on the server
 * and during the hydration render, then updates, so the first client render
 * matches the server HTML. Do not branch `initial` values on it; rely on
 * MotionConfig reducedMotion="user" to strip transforms from animations.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Non-hook check for imperative code (event handlers, celebrate()). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

const STRIPPED = new Set([
  "x",
  "y",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
]);

function strip<T>(target: T): T {
  if (!target || typeof target !== "object") return target;
  return Object.fromEntries(
    Object.entries(target as Record<string, unknown>).filter(([k]) => !STRIPPED.has(k)),
  ) as T;
}

/**
 * Removes x, y, scale and rotate from every variant (including function
 * variants), keeping opacity and transitions. Use for reduced-motion fallbacks.
 */
export function reduceVariants<V extends Variants>(variants: V): V {
  const out: Variants = {};
  for (const [name, variant] of Object.entries(variants)) {
    out[name] =
      typeof variant === "function"
        ? (...args: Parameters<typeof variant>) => {
            const r = variant(...args);
            return typeof r === "string" ? r : strip(r);
          }
        : strip(variant);
  }
  return out as V;
}
