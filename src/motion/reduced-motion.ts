"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** True when the user prefers reduced motion. SSR-safe (false on the server). */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

/** Non-hook check for imperative code (event handlers, celebrate()). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
