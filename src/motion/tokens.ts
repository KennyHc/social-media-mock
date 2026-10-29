import type { Transition } from "motion/react";

/**
 * Single source of truth for all motion values in Circle.
 * No literal durations, easings or spring numbers belong anywhere else.
 */

type Bezier = [number, number, number, number];

/** Durations in seconds. Entrances use these; exits use `exit(d)`. */
export const duration = {
  instant: 0.1,
  micro: 0.18,
  short: 0.25,
  medium: 0.35,
  long: 0.45,
} as const;

/** Exits run at 60% of the matching entrance duration. */
export const exitScale = 0.6;

/** Returns the (faster) exit duration for an entrance duration `d`. */
export const exit = (d: number): number => d * exitScale;

/** Cubic-bezier easings. `out` for entrances, `in` for exits. */
export const ease: { out: Bezier; in: Bezier; inOut: Bezier; linear: "linear" } = {
  out: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
  linear: "linear",
};

/** Spring presets for interactive elements. */
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 32, mass: 0.8 },
  gentle: { type: "spring", stiffness: 260, damping: 30 },
  bouncy: { type: "spring", stiffness: 420, damping: 14 },
  sheet: { type: "spring", stiffness: 380, damping: 38 },
} satisfies Record<string, Transition>;

/** List stagger: a fixed step, capped so long lists never feel slow. */
export const stagger = { step: 0.04, max: 8 } as const;

/** Delay in seconds for the item at `index`, capped at `stagger.max` steps. */
export const staggerDelay = (index: number): number =>
  Math.min(Math.max(index, 0), stagger.max) * stagger.step;

/** Travel distances in px (or a relative CSS length where noted). */
export const distance = {
  enterY: 12,
  pageX: 24,
  shake: 6,
  /** Toast slide-in offset. */
  toastY: 16,
  /** Digit roll offset for AnimatedNumber (percent of its own height). */
  roll: "60%",
} as const;

/** Scale applied while a pressable is held down. */
export const pressScale = 0.96;

/** Other scale constants. */
export const scale = {
  /** Modal / popover entrance start. */
  modalFrom: 0.96,
  /** Removed list items shrink slightly while fading. */
  itemExit: 0.98,
  /** Checkmark / logo pop-in start. */
  popFrom: 0.8,
} as const;

/** Misc timings. `*Ms` values are milliseconds for timers, the rest are seconds. */
export const timing = {
  shake: 0.3,
  spin: 0.8,
  reducedFade: 0.15,
  toastMs: 4000,
  successHoldMs: 1200,
  ringSettleMs: 350,
  /** Splash holds this long (ring stroke) before lifting out. */
  splashHoldMs: 450,
} as const;

/** Gesture thresholds shared by Sheet and Toast. */
export const gesture = {
  /** Fraction of the sheet height that triggers dismiss. */
  sheetFraction: 0.3,
  /** Velocity in px/s that triggers dismiss. */
  dismissVelocity: 500,
  /** Horizontal px offset that dismisses a toast. */
  swipeOffset: 100,
} as const;

/** Preset transitions. */
export const enter: Transition = { duration: duration.short, ease: ease.out };
export const exitT: Transition = { duration: exit(duration.short), ease: ease.in };
export const layout: Transition = spring.gentle;

/**
 * Particle system shared by canvas-confetti and the DOM ParticleBurst so both
 * have the same feel. Units follow canvas-confetti's options.
 */
export const particles = {
  physics: {
    gravity: 1,
    decay: 0.91,
    startVelocity: 45,
    spread: 70,
    ticks: 200,
  },
  small: { count: 40, spread: 60 },
  large: {
    count: 160,
    bursts: 5,
    /** Total time the shower is spread over, ms. */
    durationMs: 1200,
  },
  /** DOM burst (ParticleBurst). */
  burst: {
    count: 10,
    /** Frames simulated (about 520 ms at 60 fps). */
    frames: 31,
    /** Fraction of physics.startVelocity used for the small DOM burst. */
    velocityScale: 0.25,
    /** Particle diameter in px. */
    size: 7,
  },
} as const;

/** canvas-confetti applies gravity * 3 px per frame. */
const GRAVITY_PX = 3;

/**
 * Simulates one particle with the shared physics (same per-frame step that
 * canvas-confetti uses) and returns x/y keyframes in px, starting at 0.
 */
export function simulateParticle(
  angleRad: number,
  velocity: number,
  frames: number = particles.burst.frames,
): { x: number[]; y: number[] } {
  const { gravity, decay } = particles.physics;
  const x = [0];
  const y = [0];
  let px = 0;
  let py = 0;
  let v = velocity;
  for (let i = 0; i < frames; i++) {
    px += Math.cos(angleRad) * v;
    py += Math.sin(angleRad) * v + gravity * GRAVITY_PX;
    v *= decay;
    x.push(px);
    y.push(py);
  }
  return { x, y };
}

const PALETTE_VARS = ["--accent", "--accent-2", "--accent-3", "--success"] as const;

/**
 * Reads the accent palette from computed styles at call time, so it follows
 * the current theme. Returns [] on the server.
 */
export function palette(): string[] {
  if (typeof document === "undefined") return [];
  const cs = getComputedStyle(document.documentElement);
  return PALETTE_VARS.map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
}
