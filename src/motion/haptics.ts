import { prefersReducedMotion } from "./reduced-motion";

export type HapticKind = "light" | "medium" | "success" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 40, 18],
  error: [24, 40, 24, 40, 24],
};

/** Vibrates with a pattern for `kind`. No-op when unsupported or under reduced motion. */
export function haptic(kind: HapticKind): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw without a user gesture; haptics are best-effort.
  }
}
